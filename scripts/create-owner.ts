import "dotenv/config";
import { db } from "../src/lib/db";
import { z } from "zod";
import { hashPassword } from "../src/lib/password";
async function main() {
  const email = z.email().max(254).parse(process.env.OWNER_EMAIL).toLowerCase();
  const password = z
    .string()
    .min(12)
    .max(128)
    .parse(process.env.OWNER_PASSWORD);
  if (await db.user.findUnique({ where: { email } }))
    throw new Error("Account already exists. No credentials changed.");
  await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      settings: { create: {} },
    },
  });
  console.log(
    "Owner account created. Sign in with your configured email and password.",
  );
}
main()
  .catch((e) => {
    console.error(
      e instanceof z.ZodError
        ? "Set OWNER_EMAIL and OWNER_PASSWORD (12–128 characters)."
        : e.message,
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
