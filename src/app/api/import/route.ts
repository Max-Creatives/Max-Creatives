import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, apiError, readJson, HttpError } from "@/lib/http";
import { parseLeadCsv, MAX_CSV_BYTES } from "@/lib/csv";
const input = z.object({
  fileName: z.string().min(1).max(200),
  csv: z.string().min(1),
  commit: z.boolean().default(false),
});
export async function POST(request: Request) {
  try {
    const user = await apiUser(request);
    const body = input.parse(await readJson(request, MAX_CSV_BYTES * 2 + 1024));
    if (!body.fileName.toLowerCase().endsWith(".csv"))
      throw new HttpError(400, "Choose a .csv file.");
    const process = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.lead.findMany({
        where: { userId: user.id },
        select: { phone: true, email: true },
      });
      let preview;
      try {
        preview = parseLeadCsv(
          body.csv,
          new Set(existing.map((l) => l.phone)),
          new Set(existing.flatMap((l) => (l.email ? [l.email] : []))),
        );
      } catch (e) {
        throw new HttpError(
          400,
          e instanceof Error ? e.message : "Invalid CSV.",
        );
      }
      if (!body.commit) return { ...preview, committed: false };
      if (!preview.ready)
        throw new HttpError(400, "There are no new valid leads to import.");
      const batch = await tx.importBatch.create({
        data: {
          userId: user.id,
          fileName: body.fileName,
          total: preview.total,
          imported: preview.ready,
          skipped: preview.duplicates,
          errors: preview.invalid,
        },
      });
      const leads = preview.rows
        .filter((r) => r.status === "ready" && r.lead)
        .map((r) => ({ ...r.lead!, userId: user.id, importId: batch.id }));
      await tx.lead.createMany({ data: leads });
      for (const lead of leads.filter(
        (l) => l.outreachStatus === "do_not_contact" && l.email,
      )) {
        await tx.suppression.upsert({
          where: { userId_email: { userId: user.id, email: lead.email! } },
          create: {
            userId: user.id,
            email: lead.email!,
            reason: "Imported do-not-contact instruction",
          },
          update: {},
        });
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "leads.imported",
          entityId: batch.id,
          details: {
            imported: preview.ready,
            skipped: preview.duplicates,
            invalid: preview.invalid,
          },
        },
      });
      return { ...preview, committed: true, batchId: batch.id };
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return NextResponse.json(
          await db.$transaction(process, {
            isolationLevel: "Serializable",
            timeout: 30000,
          }),
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2034", "P2002"].includes(error.code) &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
    throw new HttpError(
      409,
      "Another import changed your leads. Preview the file again.",
    );
  } catch (error) {
    return apiError(error);
  }
}
