import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertOrigin, apiError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
