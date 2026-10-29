import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, apiError, readJson, HttpError } from "@/lib/http";
import { safeWebsite } from "@/lib/csv";
const nullableText = z
  .string()
  .max(5000)
  .transform((v) => v.trim() || null);
const schema = z.object({
  businessName: nullableText,
  email: z
    .union([z.literal(""), z.email().max(254)])
    .transform((v) => v.toLowerCase() || null),
  website: z.string().max(2000),
  industry: nullableText,
  state: nullableText,
  source: nullableText,
  notes: nullableText,
  doNotContact: z.boolean(),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await apiUser(request),
      { id } = await params;
    const body = schema.parse(await readJson(request));
    const website = body.website ? safeWebsite(body.website) : null;
    if (body.website && !website)
      throw new HttpError(400, "Enter a valid HTTP or HTTPS website.");
    const lead = await db.$transaction(async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) throw new HttpError(404, "Lead not found.");
      if (existing.outreachStatus === "do_not_contact" && !body.doNotContact)
        throw new HttpError(
          400,
          "An excluded lead cannot be re-enabled here. Keep the opt-out instruction.",
        );
      const { doNotContact, ...fields } = body;
      const updated = await tx.lead.update({
        where: { id },
        data: {
          ...fields,
          website,
          researchStatus: "manual_review",
          verifiedAt: null,
          confidence: null,
          outreachStatus: doNotContact
            ? "do_not_contact"
            : existing.outreachStatus,
        },
      });
      if (doNotContact)
        for (const email of new Set(
          [existing.email, body.email].filter((e): e is string => !!e),
        )) {
          await tx.suppression.upsert({
            where: { userId_email: { userId: user.id, email } },
            create: { userId: user.id, email, reason: "Manually excluded" },
            update: {},
          });
        }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: doNotContact ? "lead.excluded" : "lead.updated",
          entityId: id,
        },
      });
      return updated;
    });
    return NextResponse.json({ lead });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return apiError(
        new HttpError(409, "That email already belongs to another lead."),
      );
    return apiError(error);
  }
}
