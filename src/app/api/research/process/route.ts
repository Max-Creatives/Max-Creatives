import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, apiError, readJson, HttpError } from "@/lib/http";
import { processResearch } from "@/lib/research/queue";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const user = await apiUser(request);
    const { batchId } = z
      .object({ batchId: z.string().min(1).max(100) })
      .parse(await readJson(request));
    if (
      !(await db.researchBatch.count({
        where: { id: batchId, userId: user.id },
      }))
    )
      throw new HttpError(404, "Batch not found.");
    return Response.json({
      processed: await processResearch(user.id, batchId),
    });
  } catch (error) {
    return apiError(error);
  }
}
