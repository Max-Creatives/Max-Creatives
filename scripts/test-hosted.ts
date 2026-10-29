import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import pg from "pg";

async function main() {
  const original = new URL(process.env.DATABASE_URL!);
  assert(
    ["localhost", "127.0.0.1"].includes(original.hostname),
    "Hosted tests require a local disposable PostgreSQL cluster, not production.",
  );
  const admin = new pg.Client({ connectionString: original.toString() });
  await admin.connect();
  const name = `hosted_test_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(original);
  url.pathname = `/${name}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url.toString(),
    OWNER_EMAIL: "hosted-test@example.test",
    OWNER_PASSWORD: randomUUID(),
  };
  const database = new pg.Client({ connectionString: url.toString() });
  let server: ChildProcess | undefined;
  try {
    await database.connect();
    const run = (script: string, variables = env) =>
      spawnSync("npm", ["exec", "--no", "--", "tsx", script], {
        env: variables,
        encoding: "utf8",
        timeout: 30000,
      });
    assert.equal(
      run("scripts/migrate.ts").status,
      0,
      "Fresh SQL migration failed",
    );
    assert.equal(
      run("scripts/migrate.ts").status,
      0,
      "Repeated migration failed",
    );
    assert.notEqual(
      run("scripts/bootstrap-hosted.ts", {
        ...env,
        OWNER_EMAIL: "",
        OWNER_PASSWORD: "",
      }).status,
      0,
      "Empty workspace must require credentials",
    );
    assert.equal(
      run("scripts/bootstrap-hosted.ts").status,
      0,
      "Initial owner creation failed",
    );
    const first = (await database.query('SELECT "passwordHash" FROM "User"'))
      .rows[0].passwordHash;
    assert.equal(
      run("scripts/bootstrap-hosted.ts", {
        ...env,
        OWNER_EMAIL: "different@example.test",
        OWNER_PASSWORD: randomUUID(),
      }).status,
      0,
      "Restart must preserve existing accounts",
    );
    const users = await database.query('SELECT "passwordHash" FROM "User"');
    assert.equal(users.rowCount, 1);
    assert.equal(users.rows[0].passwordHash, first);
    console.log(
      "PASS initial owner creation, missing-credential rejection, repeatable migrations and credential preservation",
    );

    const socket = createServer();
    await new Promise<void>((resolve) =>
      socket.listen(0, "127.0.0.1", resolve),
    );
    const address = socket.address();
    assert(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((resolve, reject) =>
      socket.close((error) => (error ? reject(error) : resolve())),
    );
    const serverEnv: NodeJS.ProcessEnv = {
      ...env,
      PORT: String(port),
      RENDER_EXTERNAL_URL: "https://max-outreach-test.onrender.com",
    };
    delete serverEnv.APP_URL;
    delete serverEnv.OWNER_EMAIL;
    delete serverEnv.OWNER_PASSWORD;
    server = spawn("bash", ["scripts/start-hosted.sh"], {
      env: serverEnv,
      detached: true,
      stdio: "ignore",
    });
    const target = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 40; i++) {
      if (server.exitCode !== null)
        throw new Error("Hosted startup exited before readiness.");
      try {
        const response = await fetch(`${target}/api/health`);
        if (response.ok && (await response.json()).status === "ok") {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert(ready, "Hosted application did not become ready");
    const login = await fetch(`${target}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: serverEnv.RENDER_EXTERNAL_URL!,
      },
      body: JSON.stringify({
        email: env.OWNER_EMAIL,
        password: env.OWNER_PASSWORD,
      }),
    });
    assert.equal(login.status, 200, "Hosted login failed");
    assert.match(login.headers.get("set-cookie") || "", /Secure/);
    console.log(
      "PASS hosted start command, host-provided APP_URL, existing-account restart, health and Secure-cookie login",
    );
  } finally {
    if (server?.pid && server.exitCode === null) {
      const exited = new Promise<void>((resolve) =>
        server!.once("exit", () => resolve()),
      );
      process.kill(-server.pid, "SIGTERM");
      await exited;
    }
    await database.end();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    console.log(
      "Disposable hosted-test database and application process removed.",
    );
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Hosted validation failed",
  );
  process.exitCode = 1;
});
