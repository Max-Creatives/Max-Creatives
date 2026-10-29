import "dotenv/config";
import { z } from "zod";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('max_outreach_bootstrap'))`;
    if (await tx.user.count()) {
      console.log("Existing workspace accounts preserved; bootstrap skipped.");
      return;
    }
    const email = z
      .email()
      .max(254)
      .parse(process.env.OWNER_EMAIL)
      .toLowerCase();
    const password = z
      .string()
      .min(12)
      .max(128)
      .parse(process.env.OWNER_PASSWORD);
    const owner = await tx.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        settings: { create: {} },
      },
    });
    await tx.auditLog.create({
      data: { userId: owner.id, action: "auth.owner_bootstrapped" },
    });
    console.log(
      "Initial workspace owner created. No existing credentials were changed.",
    );
  });
}

main()
  .catch((error) => {
    console.error(
      error instanceof z.ZodError
        ? "An empty hosted database needs OWNER_EMAIL and OWNER_PASSWORD (12–128 characters). Enter these securely in your hosting dashboard."
        : "Owner bootstrap failed. Check database availability and server logs.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
