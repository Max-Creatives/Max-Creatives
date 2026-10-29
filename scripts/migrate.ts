import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
// Run the checked-in, Prisma-generated SQL atomically without native engines.
// A database lock serializes concurrent deployments; checksums detect drift.
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  await client.connect();
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('max_outreach_migrations'))",
    );
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_max_migrations" (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const root = resolve("prisma/migrations");
    const directories = (await readdir(root, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const applied = new Map<string, string>(
      (
        await client.query('SELECT name, checksum FROM "_max_migrations"')
      ).rows.map((r) => [r.name, r.checksum]),
    );
    for (const name of applied.keys())
      if (!directories.includes(name))
        throw new Error(`Applied migration ${name} is missing from disk.`);
    let count = 0;
    for (const name of directories) {
      const sql = await readFile(resolve(root, name, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      if (applied.has(name)) {
        if (applied.get(name) !== checksum)
          throw new Error(`Migration ${name} was modified after application.`);
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO "_max_migrations" (name, checksum) VALUES ($1, $2)',
        [name, checksum],
      );
      count++;
      console.log(`Applied ${name}`);
    }
    await client.query("COMMIT");
    console.log(`${count} migration(s) applied; database is up to date.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
main()
  .catch((error) => {
    console.error(
      "Migration failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exitCode = 1;
  })
  .finally(() => client.end());
