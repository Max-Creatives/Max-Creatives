import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertOrigin, readJson, apiError, HttpError } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { newSession, SESSION_COOKIE } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { email, password } = z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        password: z.string().min(1).max(128),
      })
      .parse(await readJson(request));
    const key = createHash("sha256").update(email).digest("hex");
    const now = new Date();
    await db.loginAttempt.deleteMany({ where: { key, resetAt: { lte: now } } });
    const attempt = await db.loginAttempt.upsert({
      where: { key },
      create: { key, resetAt: new Date(Date.now() + 15 * 60_000) },
      update: { count: { increment: 1 } },
    });
    if (attempt.count > 10)
      throw new HttpError(
        429,
        "Too many sign-in attempts. Try again in 15 minutes.",
      );
    const user = await db.user.findUnique({ where: { email } });
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`,
    );
    if (!user || !valid)
      throw new HttpError(401, "Email or password is incorrect.");
    const { token, expires } = await newSession(user.id);
    await db.auditLog.create({
      data: { userId: user.id, action: "auth.login" },
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: new URL(process.env.APP_URL!).protocol === "https:",
      sameSite: "lax",
      path: "/",
      expires,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
