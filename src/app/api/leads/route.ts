import { NextResponse } from "next/server";
import { apiError, apiUser } from "@/lib/http";
import { queryLeads } from "@/lib/queries";
export async function GET(request: Request) {
  try {
    const user = await apiUser();
    return NextResponse.json(
      await queryLeads(
        user.id,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
