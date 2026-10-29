import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, apiError, readJson } from "@/lib/http";
import { db } from "@/lib/db";
export async function PATCH(request: Request) {
  try {
    const user = await apiUser(request);
    const body = z
      .object({
        senderName: z.string().trim().min(1).max(100),
        postalAddress: z.string().trim().max(1000),
        mode: z.enum(["research_only", "draft_only"]),
        monthlyBudget: z.number().int().min(0).max(10000),
      })
      .parse(await readJson(request));
    const settings = await db.$transaction(async (tx) => {
      const s = await tx.workspaceSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...body },
        update: body,
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: "settings.updated" },
      });
      return s;
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return apiError(error);
  }
}
