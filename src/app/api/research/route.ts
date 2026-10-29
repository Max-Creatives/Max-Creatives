import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, apiError, readJson } from "@/lib/http";
import {
  createBatch,
  controlBatch,
  researchConfig,
} from "@/lib/research/queue";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await apiUser();
    const id = new URL(request.url).searchParams.get("batchId");
    const params = new URL(request.url).searchParams;
    const batchCount = await db.researchBatch.count({
      where: { userId: user.id, ...(id ? { id } : {}) },
    });
    const historyPages = Math.max(1, Math.ceil(batchCount / 8));
    const historyPage = Math.min(
      historyPages,
      Math.max(1, Number.parseInt(params.get("historyPage") || "1", 10) || 1),
    );
    const q = (params.get("q") || "").slice(0, 200);
    const where = {
      userId: user.id,
      verifiedAt: null,
      outreachStatus: { not: "do_not_contact" },
      ...(q
        ? {
            OR: [
              { phone: { contains: q } },
              { businessName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const count = await db.lead.count({ where });
    const pages = Math.max(1, Math.ceil(count / 25));
    const page = Math.min(
      pages,
      Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1),
    );
    const [config, batches, leads, discovered] = await Promise.all([
      researchConfig(user.id),
      db.researchBatch.findMany({
        where: { userId: user.id, ...(id ? { id } : {}) },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: id ? 1 : 8,
        skip: id ? 0 : (historyPage - 1) * 8,
        include: {
          jobs: {
            orderBy: { createdAt: "asc" },
            include: {
              lead: {
                select: {
                  id: true,
                  phone: true,
                  businessName: true,
                  website: true,
                  email: true,
                },
              },
              candidates: { orderBy: { createdAt: "asc" } },
              logs: { orderBy: { createdAt: "desc" }, take: 15 },
            },
          },
        },
      }),
      db.lead.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 25,
        skip: (page - 1) * 25,
        select: {
          id: true,
          phone: true,
          businessName: true,
          website: true,
          email: true,
          researchStatus: true,
        },
      }),
      db.lead.findMany({
        where: {
          userId: user.id,
          verifiedAt: { not: null },
          discoveredAt: { not: null },
          email: { not: null },
        },
        orderBy: { discoveredAt: "desc" },
        take: 25,
        select: {
          id: true,
          businessName: true,
          phone: true,
          email: true,
          sourceUrl: true,
          discoveredAt: true,
        },
      }),
    ]);
    return Response.json(
      {
        config,
        batches,
        leads,
        discovered,
        count,
        page,
        pages,
        historyPage,
        historyPages,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await apiUser(request);
    const body = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("create"),
          leadIds: z.array(z.string().min(1).max(100)).min(1).max(25),
          acknowledge: z.literal(true),
        }),
        z.object({
          action: z.enum(["pause", "resume", "retry"]),
          batchId: z.string().min(1).max(100),
        }),
      ])
      .parse(await readJson(request));
    if (body.action === "create")
      return Response.json({
        batch: await createBatch(user.id, [...new Set(body.leadIds)]),
      });
    return Response.json({
      batch: await controlBatch(user.id, body.batchId, body.action),
    });
  } catch (error) {
    return apiError(error);
  }
}
