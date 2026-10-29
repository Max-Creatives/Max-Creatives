import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { claimResearchJob } from "../src/lib/research/queue";
const base =
  process.env.TEST_BASE_URL || process.env.APP_URL || "http://localhost:3000";
const emails = [1, 2].map(() => `research-test-${randomUUID()}@example.test`);
const password = randomUUID();
let count = 0;
function check(value: unknown, label: string) {
  assert(value, label);
  count++;
  console.log(`PASS ${label}`);
}
async function api(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  origin = new URL(base).origin,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: (response.headers.get("set-cookie") || "").split(";")[0],
  };
}
async function main() {
  const user = await db.user.create({
    data: { email: emails[0], passwordHash: await hashPassword(password) },
  });
  const other = await db.user.create({
    data: { email: emails[1], passwordHash: await hashPassword(password) },
  });
  const lead = await db.lead.create({
    data: {
      userId: user.id,
      phone: "+14155552671",
      website: "https://fixture-studio.com/",
    },
  });
  const phoneOnly = await db.lead.create({
    data: { userId: user.id, phone: "+12025550123" },
  });
  const excluded = await db.lead.create({
    data: {
      userId: user.id,
      phone: "+12125550123",
      outreachStatus: "do_not_contact",
    },
  });
  const cookie = (
    await api("/api/auth/login", "POST", { email: emails[0], password })
  ).cookie;
  const cookie2 = (
    await api("/api/auth/login", "POST", { email: emails[1], password })
  ).cookie;
  check(
    (await api("/api/research")).status === 401,
    "research data requires authentication",
  );
  const create = { action: "create", leadIds: [lead.id], acknowledge: true };
  check(
    (
      await api(
        "/api/research",
        "POST",
        { ...create, acknowledge: false },
        cookie,
      )
    ).status === 400,
    "public-source review acknowledgment required",
  );
  check(
    (await api("/api/research", "POST", create, cookie2)).status === 404,
    "another user's leads cannot be queued",
  );
  check(
    (await api("/api/research", "POST", create, cookie, "https://evil.example"))
      .status === 403,
    "cross-origin research denied",
  );
  check(
    (
      await api(
        "/api/research",
        "POST",
        { ...create, leadIds: [excluded.id] },
        cookie,
      )
    ).status === 400,
    "excluded leads cannot be researched",
  );
  const initial = await api("/api/research", "GET", undefined, cookie);
  if (!initial.body.config.searchConfigured)
    check(
      (
        await api(
          "/api/research",
          "POST",
          { ...create, leadIds: [phoneOnly.id] },
          cookie,
        )
      ).status === 400,
      "phone-only lookup reports the missing provider without fabricating results",
    );
  const batch = (await api("/api/research", "POST", create, cookie)).body.batch;
  check(
    !!batch.id,
    "owned supplied-website lead can be queued without search billing",
  );
  check(
    (await api("/api/research", "POST", create, cookie)).status === 409,
    "active duplicate work is blocked",
  );
  check(
    (
      await api(
        "/api/research",
        "POST",
        { action: "pause", batchId: batch.id },
        cookie,
      )
    ).body.batch.status === "paused",
    "pause persists",
  );
  check(
    (await api("/api/research/process", "POST", { batchId: batch.id }, cookie))
      .body.processed === false,
    "paused jobs are not claimed",
  );
  check(
    (await api("/api/research/process", "POST", { batchId: batch.id }, cookie2))
      .status === 404,
    "another user cannot process a batch",
  );
  check(
    (
      await api(
        "/api/research",
        "POST",
        { action: "resume", batchId: batch.id },
        cookie,
      )
    ).body.batch.status === "running",
    "resume persists",
  );
  const claimed = await claimResearchJob(user.id, batch.id);
  check(
    claimed?.attempts === 1,
    "durable job claim records its attempt and lease",
  );
  check(
    (await claimResearchJob(user.id, batch.id)) === null,
    "a live lease prevents duplicate processing",
  );
  await db.researchJob.update({
    where: { id: claimed!.id },
    data: { leaseUntil: new Date(0) },
  });
  const resumed = await claimResearchJob(user.id, batch.id);
  check(
    resumed?.attempts === 2 && resumed.leaseToken !== claimed?.leaseToken,
    "expired leases are resumable with a new ownership token",
  );
  // Synthetic evidence exercises review APIs; this is not a successful live lookup.
  await db.researchJob.update({
    where: { id: claimed!.id },
    data: { status: "completed", leaseUntil: null, leaseToken: null },
  });
  await db.researchBatch.update({
    where: { id: batch.id },
    data: { status: "completed" },
  });
  const source = "https://fixture-studio.com/contact",
    publishedEmail = "hello@fixture-studio.com",
    discoveredAt = new Date().toISOString();
  const evidence = {
    pages: [
      {
        url: source,
        discoveredAt,
        phoneMatched: true,
        emails: [publishedEmail],
        title: "Synthetic contact-page fixture",
      },
    ],
    emails: [{ email: publishedEmail, sourceUrl: source, discoveredAt }],
    services: "Synthetic test fixture, not a real researched business.",
  };
  const candidate = await db.researchCandidate.create({
    data: {
      jobId: claimed!.id,
      businessName: "Synthetic Fixture Studio",
      website: "https://fixture-studio.com",
      phoneMatched: true,
      confidence: 90,
      evidence,
    },
  });
  const unverified = await db.researchCandidate.create({
    data: {
      jobId: claimed!.id,
      website: "https://unmatched-fixture.com",
      phoneMatched: false,
      confidence: 20,
      evidence: { ...evidence, pages: [], emails: [] },
    },
  });
  const review = {
    candidateId: candidate.id,
    action: "approve",
    email: publishedEmail,
  };
  check(
    (await api("/api/research/review", "POST", review, cookie2)).status === 404,
    "finding review is owner-scoped",
  );
  check(
    (
      await api(
        "/api/research/review",
        "POST",
        { ...review, candidateId: unverified.id, email: null },
        cookie,
      )
    ).status === 400,
    "unmatched phones cannot be approved as verified",
  );
  check(
    (
      await api(
        "/api/research/review",
        "POST",
        { ...review, email: "invented@fixture-studio.com" },
        cookie,
      )
    ).status === 400,
    "unpublished email guesses are rejected",
  );
  await db.suppression.create({
    data: {
      userId: user.id,
      email: publishedEmail,
      reason: "Synthetic suppression test",
    },
  });
  check(
    (await api("/api/research/review", "POST", review, cookie)).status === 400,
    "suppression prevents saving a discovered contact for outreach",
  );
  await db.suppression.deleteMany({ where: { userId: user.id } });
  const approved = await api("/api/research/review", "POST", review, cookie);
  check(
    approved.status === 200 &&
      approved.body.lead.email === publishedEmail &&
      approved.body.lead.verifiedAt &&
      approved.body.lead.sourceUrl === source &&
      approved.body.lead.discoveredAt,
    "human review saves the business, published email and evidence date",
  );
  check(
    (await api("/api/research/review", "POST", review, cookie)).status === 409,
    "repeated approval is rejected",
  );
  const state = await api("/api/research", "GET", undefined, cookie);
  check(
    state.body.discovered.length === 1 &&
      state.body.leads.every((l: { id: string }) => l.id !== lead.id),
    "reviewed discovery is listed and verified leads leave the queue",
  );
  check(
    (await api("/api/research", "GET", undefined, cookie2)).body.batches
      .length === 0,
    "research findings are isolated between users",
  );
  check(
    (
      await api(
        "/api/research/review",
        "POST",
        { candidateId: unverified.id, action: "reject" },
        cookie,
      )
    ).status === 200,
    "ambiguous findings can be rejected",
  );
  await db.researchJob.update({
    where: { id: claimed!.id },
    data: { status: "failed", attempts: 3, error: "Synthetic interrupted job" },
  });
  check(
    (
      await api(
        "/api/research",
        "POST",
        { action: "retry", batchId: batch.id },
        cookie,
      )
    ).body.batch.status === "running",
    "manual retry restores failed work",
  );
  const retried = await db.researchJob.findUnique({
    where: { id: claimed!.id },
  });
  check(
    retried?.status === "queued" && retried.attempts === 0,
    "retry resets the bounded attempt counter",
  );
  check(
    (await db.auditLog.count({
      where: { userId: user.id, action: "research.finding_approved" },
    })) === 1,
    "approval has an audit record",
  );
  check(
    (await db.searchUsage.count({ where: { userId: user.id } })) === 0,
    "fixture validation makes no paid search requests",
  );
  console.log(
    `${count} research integration checks passed with synthetic evidence; no live provider lookup was claimed.`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.loginAttempt.deleteMany({
      where: {
        key: {
          in: emails.map((email) =>
            createHash("sha256").update(email).digest("hex"),
          ),
        },
      },
    });
    await db.$disconnect();
  });
