import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiUser, apiError, readJson, HttpError } from "@/lib/http";
import { candidateEvidence } from "@/lib/research/evidence";
export async function POST(request: Request) {
  try {
    const user = await apiUser(request);
    const body = z
      .object({
        candidateId: z.string().min(1).max(100),
        action: z.enum(["approve", "reject"]),
        email: z.email().nullable().optional(),
      })
      .parse(await readJson(request));
    const lead = await db.$transaction(async (tx) => {
      const candidate = await tx.researchCandidate.findFirst({
        where: { id: body.candidateId, job: { batch: { userId: user.id } } },
        include: { job: { include: { lead: true } } },
      });
      if (!candidate) throw new HttpError(404, "Finding not found.");
      if (candidate.decision)
        throw new HttpError(409, "This finding was already reviewed.");
      const claimed = await tx.researchCandidate.updateMany({
        where: { id: candidate.id, decision: null },
        data: {
          decision: body.action === "approve" ? "approved" : "rejected",
          reviewedAt: new Date(),
        },
      });
      if (!claimed.count)
        throw new HttpError(409, "This finding was already reviewed.");
      if (body.action === "reject") {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "research.finding_rejected",
            entityId: candidate.id,
          },
        });
        return null;
      }
      if (!candidate.phoneMatched)
        throw new HttpError(
          400,
          "This finding has no exact phone match. It cannot be marked as verified.",
        );
      if (candidate.job.lead.outreachStatus === "do_not_contact")
        throw new HttpError(400, "This lead has been excluded from contact.");
      const evidence = candidateEvidence.parse(candidate.evidence);
      if (
        !evidence.pages.some(
          (p) => p.phoneMatched && new URL(p.url).origin === candidate.website,
        )
      )
        throw new HttpError(
          400,
          "The recorded source does not support this phone match.",
        );
      const email = body.email
        ? evidence.emails.find((e) => e.email === body.email)
        : null;
      if (body.email && !email)
        throw new HttpError(
          400,
          "Choose an email actually published in this finding's recorded sources.",
        );
      if (
        email &&
        !evidence.pages.some(
          (p) =>
            p.url === email.sourceUrl &&
            p.emails.includes(email.email) &&
            new URL(p.url).origin === candidate.website,
        )
      )
        throw new HttpError(
          400,
          "The email is not supported by a checked page on this business website.",
        );
      if (
        email &&
        (await tx.suppression.count({
          where: { userId: user.id, email: email.email },
        }))
      )
        throw new HttpError(400, "That email is on your suppression list.");
      const changed = await tx.lead.updateMany({
        where: {
          id: candidate.job.leadId,
          userId: user.id,
          verifiedAt: null,
          outreachStatus: { not: "do_not_contact" },
        },
        data: {
          website: candidate.website,
          ...(candidate.businessName
            ? { businessName: candidate.businessName }
            : {}),
          ...(email
            ? {
                email: email.email,
                sourceUrl: email.sourceUrl,
                discoveredAt: new Date(email.discoveredAt),
              }
            : {}),
          researchStatus: "verified",
          verifiedAt: new Date(),
          confidence: candidate.confidence,
        },
      });
      if (!changed.count)
        throw new HttpError(
          409,
          "This lead was already verified or excluded. Refresh the findings before reviewing it again.",
        );
      const updated = await tx.lead.findUniqueOrThrow({
        where: { id: candidate.job.leadId },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "research.finding_approved",
          entityId: candidate.id,
          details: {
            leadId: updated.id,
            emailSelected: !!email,
            sourceUrl: email?.sourceUrl || candidate.website,
          },
        },
      });
      return updated;
    });
    return Response.json({ lead });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return apiError(
        new HttpError(
          409,
          "This email already belongs to another lead. Review the existing record.",
        ),
      );
    return apiError(error);
  }
}
