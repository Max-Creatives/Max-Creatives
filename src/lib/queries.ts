import { Prisma } from "@prisma/client";
import { db } from "./db";
export async function workspaceStats(userId: string) {
  const [
    total,
    verified,
    emails,
    unresolved,
    review,
    excluded,
    imports,
    recentImports,
  ] = await Promise.all([
    db.lead.count({ where: { userId } }),
    db.lead.count({ where: { userId, verifiedAt: { not: null } } }),
    db.lead.count({ where: { userId, email: { not: null } } }),
    db.lead.count({ where: { userId, researchStatus: "unresolved" } }),
    db.lead.count({ where: { userId, researchStatus: "manual_review" } }),
    db.lead.count({ where: { userId, outreachStatus: "do_not_contact" } }),
    db.importBatch.count({ where: { userId } }),
    db.importBatch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  return {
    total,
    verified,
    emails,
    unresolved,
    review,
    excluded,
    imports,
    recentImports,
  };
}
export async function queryLeads(
  userId: string,
  params: { q?: string; status?: string; page?: string },
) {
  const q = (typeof params.q === "string" ? params.q : "").slice(0, 200);
  const status = [
    "unresolved",
    "manual_review",
    "verified",
    "do_not_contact",
    "has_email",
  ].includes(params.status || "")
    ? params.status
    : "";
  const where: Prisma.LeadWhereInput = {
    userId,
    ...(q
      ? {
          OR: ["businessName", "phone", "email", "industry"].map((key) => ({
            [key]: { contains: q, mode: "insensitive" },
          })),
        }
      : {}),
    ...(status === "do_not_contact"
      ? { outreachStatus: status }
      : status === "has_email"
        ? { email: { not: null } }
        : status
          ? { researchStatus: status }
          : {}),
  };
  const count = await db.lead.count({ where });
  const pages = Math.max(1, Math.ceil(count / 25));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(params.page || "1", 10) || 1),
  );
  const leads = await db.lead.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 25,
    skip: (page - 1) * 25,
  });
  return { leads, count, page, pages, q, status };
}
