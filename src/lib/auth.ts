import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { redirect } from "next/navigation";
export const SESSION_COOKIE = "max_session";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  return session && session.expiresAt > new Date() ? session.user : null;
}
export async function pageUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function newSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * 86400_000);
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt: expires },
  });
  return { token, expires };
}
