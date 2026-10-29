import "dotenv/config";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";
async function main() {
  if (!process.env.DATABASE_URL) {
    if (existsSync(".env"))
      throw new Error(
        "Existing .env has no DATABASE_URL. Configure it without overwriting your other settings.",
      );
    const password = randomBytes(32).toString("hex");
    const url = `postgresql://max:${password}@127.0.0.1:5432/max_outreach?schema=public`;
    await writeFile(
      ".env",
      `DATABASE_URL="${url}"\nAPP_URL="http://localhost:3000"\n`,
      { mode: 0o600, flag: "wx" },
    );
    process.env.DATABASE_URL = url;
    console.log(
      "Created a private .env with a random local database password.",
    );
  }
  const url = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    console.log(
      "External DATABASE_URL configured; no local Docker database started.",
    );
    return;
  }
  if (
    url.username !== "max" ||
    url.pathname !== "/max_outreach" ||
    url.port !== "5432"
  )
    throw new Error(
      "Local helper expects max@127.0.0.1:5432/max_outreach. Start custom databases separately.",
    );
  const dockerEnv = { ...process.env };
  for (const name of [
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_TLS",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
  ])
    delete dockerEnv[name];
  const docker = (args: string[]) =>
    execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
      env: dockerEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  let exists = false;
  try {
    const image = docker([
      "inspect",
      "--format",
      "{{.Config.Image}}",
      "max-outreach-db",
    ]);
    if (image !== "postgres:17-alpine")
      throw new Error("Container name is already in use by another image.");
    exists = true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Container name is already in use by another image."
    )
      throw error;
    const e = error as { stderr?: Buffer | string };
    if (!String(e.stderr || "").includes("No such object"))
      throw new Error(
        "Could not inspect the local Docker daemon. Check Docker access.",
      );
  }
  if (exists) docker(["start", "max-outreach-db"]);
  else {
    const temp = await mkdtemp(join(tmpdir(), "max-db-"));
    try {
      const envFile = join(temp, "database.env");
      await writeFile(
        envFile,
        `POSTGRES_USER=max\nPOSTGRES_DB=max_outreach\nPOSTGRES_PASSWORD=${decodeURIComponent(url.password)}\n`,
        { mode: 0o600 },
      );
      docker([
        "run",
        "-d",
        "--name",
        "max-outreach-db",
        "--env-file",
        envFile,
        "-p",
        "127.0.0.1:5432:5432",
        "-v",
        "max-outreach-postgres:/var/lib/postgresql/data",
        "postgres:17-alpine",
      ]);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
  for (let i = 0; i < 30; i++) {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 1000,
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
      console.log("Local PostgreSQL is ready.");
      return;
    } catch {
      if (i === 29)
        throw new Error(
          "PostgreSQL did not become ready. Check its logs and .env credentials; do not delete the volume.",
        );
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      await client.end();
    }
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Local database setup failed.",
  );
  process.exitCode = 1;
});
