import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { HttpError } from "../http";
import { investigate, braveSearch } from "./engine";
import { ResearchError } from "./safe-web";

export function searchLimit() {
  const number = Number(process.env.RESEARCH_MONTHLY_SEARCH_LIMIT ?? "50");
  return Number.isInteger(number) && number >= 0 && number <= 10000
    ? number
    : 50;
}
export async function reserveSearch(userId: string) {
  const month = new Date().toISOString().slice(0, 7);
  await db.searchUsage.upsert({
    where: { userId_month: { userId: userId, month } },
    create: { userId: userId, month },
    update: {},
  });
  const reserved = await db.searchUsage.updateMany({
    where: {
      userId: userId,
      month,
      requests: { lt: searchLimit() },
    },
    data: { requests: { increment: 1 } },
  });
  if (!reserved.count)
    throw new ResearchError(
      "Monthly search-request limit reached. Change the limit only after reviewing provider costs.",
    );
}
export async function researchConfig(userId: string) {
  const month = new Date().toISOString().slice(0, 7);
  const usage = await db.searchUsage.findUnique({
    where: { userId_month: { userId, month } },
  });
  return {
    searchConfigured: !!process.env.BRAVE_SEARCH_API_KEY,
    limit: searchLimit(),
    used: usage?.requests || 0,
    month,
  };
}
export async function createBatch(userId: string, leadIds: string[]) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`research-create:${userId}`}))`;
    const leads = await tx.lead.findMany({
      where: { userId, id: { in: leadIds } },
    });
    if (leads.length !== leadIds.length)
      throw new HttpError(
        404,
        "One or more selected leads could not be found.",
      );
    if (
      leads.some((l) => l.outreachStatus === "do_not_contact" || l.verifiedAt)
    )
      throw new HttpError(
        400,
        "Choose unverified leads that are not excluded from contact.",
      );
    if (!process.env.BRAVE_SEARCH_API_KEY && leads.every((l) => !l.website))
      throw new HttpError(
        400,
        "Add BRAVE_SEARCH_API_KEY in Render → Environment for phone-only lookup, or supply the official business website in a lead's details.",
      );
    const active = await tx.researchJob.count({
      where: {
        leadId: { in: leadIds },
        status: { in: ["queued", "running"] },
        batch: { userId, status: { in: ["running", "paused"] } },
      },
    });
    if (active)
      throw new HttpError(
        409,
        "Some selected leads are already in an active or paused batch. Resume that batch first.",
      );
    const batch = await tx.researchBatch.create({
      data: { userId, jobs: { create: leads.map((l) => ({ leadId: l.id })) } },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "research.batch_created",
        entityId: batch.id,
        details: { leads: leads.length, publicSourceReviewAcknowledged: true },
      },
    });
    return batch;
  });
}
async function finishBatch(batchId: string) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`research-batch:${batchId}`}))`;
    const active = await tx.researchJob.count({
      where: { batchId, status: { in: ["queued", "running"] } },
    });
    if (!active)
      await tx.researchBatch.updateMany({
        where: { id: batchId, status: "running" },
        data: { status: "completed" },
      });
  });
}
export async function claimResearchJob(userId?: string, batchId?: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('max_outreach_research_claim'))`;
    const now = new Date();
    await tx.researchJob.updateMany({
      where: {
        batch: {
          ...(userId ? { userId } : {}),
          ...(batchId ? { id: batchId } : {}),
        },
        status: "running",
        leaseUntil: { lt: now },
        attempts: { gte: 3 },
      },
      data: {
        status: "failed",
        leaseToken: null,
        leaseUntil: null,
        error:
          "Processing was interrupted after three attempts. Review the logs and retry manually.",
      },
    });
    await tx.researchBatch.updateMany({
      where: {
        status: "running",
        ...(userId ? { userId } : {}),
        ...(batchId ? { id: batchId } : {}),
        jobs: { none: { status: { in: ["queued", "running"] } } },
      },
      data: { status: "completed" },
    });
    const job = await tx.researchJob.findFirst({
      where: {
        batch: {
          status: "running",
          ...(userId ? { userId } : {}),
          ...(batchId ? { id: batchId } : {}),
        },
        attempts: { lt: 3 },
        OR: [
          { status: "queued", availableAt: { lte: now } },
          { status: "running", leaseUntil: { lt: now } },
        ],
      },
      orderBy: [{ availableAt: "asc" }, { id: "asc" }],
      include: { batch: true, lead: true },
    });
    if (!job) return null;
    const active = await tx.researchJob.count({
      where: {
        id: { not: job.id },
        batch: { userId: job.batch.userId },
        status: "running",
        leaseUntil: { gt: now },
      },
    });
    if (active) return null;
    const token = randomUUID();
    await tx.researchJob.update({
      where: { id: job.id },
      data: {
        status: "running",
        attempts: { increment: 1 },
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 90000),
        error: null,
      },
    });
    return { ...job, attempts: job.attempts + 1, leaseToken: token };
  });
}
export async function runResearchJob(
  job: NonNullable<Awaited<ReturnType<typeof claimResearchJob>>>,
) {
  const signal = AbortSignal.timeout(40000);
  const log = async (stage: string, message: string) => {
    const active = await db.researchJob.count({
      where: { id: job.id, leaseToken: job.leaseToken, status: "running" },
    });
    if (active)
      await db.researchLog.create({ data: { jobId: job.id, stage, message } });
  };
  try {
    const current = await db.lead.findUnique({ where: { id: job.leadId } });
    if (
      !current ||
      current.outreachStatus === "do_not_contact" ||
      current.verifiedAt
    )
      throw new ResearchError(
        "Lead is now excluded or already verified. Research was skipped.",
      );
    if (!current.website && !process.env.BRAVE_SEARCH_API_KEY)
      throw new ResearchError(
        "Phone-only research is blocked until BRAVE_SEARCH_API_KEY is configured.",
      );
    const findings = await investigate(current, signal, {
      log,
      search: async (query, activeSignal) => {
        await reserveSearch(job.batch.userId);
        return braveSearch(query, activeSignal);
      },
    });
    await db.$transaction(async (tx) => {
      const owned = await tx.researchJob.updateMany({
        where: { id: job.id, leaseToken: job.leaseToken, status: "running" },
        data: { status: "completed", leaseToken: null, leaseUntil: null },
      });
      if (!owned.count) return;
      await tx.researchCandidate.createMany({
        data: findings.map((f) => ({
          jobId: job.id,
          businessName: f.businessName,
          website: f.website,
          phoneMatched: f.phoneMatched,
          confidence: f.confidence,
          evidence: f.evidence as unknown as Prisma.InputJsonValue,
        })),
      });
      if (findings.length)
        await tx.lead.updateMany({
          where: { id: job.leadId, verifiedAt: null },
          data: { researchStatus: "manual_review" },
        });
      await tx.auditLog.create({
        data: {
          userId: job.batch.userId,
          action: "research.completed",
          entityId: job.id,
          details: { candidates: findings.length },
        },
      });
    });
  } catch (error) {
    const failure =
      error instanceof ResearchError
        ? error
        : new ResearchError(
            "Research was interrupted or reached its time limit.",
            true,
          );
    const retry = failure.retryable && job.attempts < 3;
    await log("error", failure.message);
    await db.researchJob.updateMany({
      where: { id: job.id, leaseToken: job.leaseToken, status: "running" },
      data: {
        status: retry
          ? "queued"
          : failure.message.includes("BRAVE_SEARCH_API_KEY") ||
              failure.message.includes("Monthly search")
            ? "blocked"
            : "failed",
        error: failure.message,
        availableAt: new Date(Date.now() + 30000 * job.attempts),
        leaseUntil: null,
        leaseToken: null,
      },
    });
  }
  await finishBatch(job.batchId);
}
export async function processResearch(userId?: string, batchId?: string) {
  const job = await claimResearchJob(userId, batchId);
  if (!job) {
    if (batchId) await finishBatch(batchId);
    return false;
  }
  await runResearchJob(job);
  return true;
}
export async function controlBatch(
  userId: string,
  batchId: string,
  action: "pause" | "resume" | "retry",
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`research-batch:${batchId}`}))`;
    const batch = await tx.researchBatch.findFirst({
      where: { id: batchId, userId },
    });
    if (!batch) throw new HttpError(404, "Batch not found.");
    if (action === "retry")
      await tx.researchJob.updateMany({
        where: { batchId, status: { in: ["failed", "blocked"] } },
        data: {
          status: "queued",
          attempts: 0,
          availableAt: new Date(),
          error: null,
        },
      });
    const result = await tx.researchBatch.update({
      where: { id: batchId },
      data: { status: action === "pause" ? "paused" : "running" },
    });
    await tx.auditLog.create({
      data: { userId, action: `research.${action}`, entityId: batchId },
    });
    return result;
  });
}
