import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
const base =
  process.env.TEST_BASE_URL || process.env.APP_URL || "http://localhost:3000";
const suffix = randomUUID();
const email = `integration-${suffix}@example.test`,
  email2 = `other-${suffix}@example.test`,
  password = `Integration-${randomUUID()}`;
let passed = 0;
function check(condition: unknown, description: string) {
  assert.ok(condition, description);
  passed++;
  console.log(`PASS ${description}`);
}
async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    origin?: string;
  } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin || new URL(base).origin,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    redirect: "manual",
  });
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { response, data, text };
}
async function main() {
  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
  const other = await db.user.create({
    data: { email: email2, passwordHash: await hashPassword(password) },
  });
  check(
    (await request("/api/health")).data.status === "ok",
    "health checks real PostgreSQL",
  );
  check(
    (await request("/api/leads")).response.status === 401,
    "anonymous lead access denied",
  );
  check(
    (await request("/api/leads/export")).response.status === 401,
    "anonymous export denied",
  );
  check(
    (await request("/")).response.status === 307,
    "workspace redirects unauthenticated users",
  );
  check(
    (
      await request("/api/auth/login", {
        method: "POST",
        origin: "https://evil.example",
        body: { email, password },
      })
    ).response.status === 403,
    "cross-origin login denied",
  );
  check(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { email, password: "wrong" },
      })
    ).response.status === 401,
    "incorrect password denied",
  );
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const setCookie = login.response.headers.get("set-cookie") || "",
    cookie = setCookie.split(";")[0];
  check(
    login.response.status === 200 &&
      setCookie.includes("HttpOnly") &&
      setCookie.includes("SameSite=lax"),
    "login issues protected session cookie",
  );
  const session = await db.session.findFirst({ where: { userId: user.id } });
  check(
    session?.id !== cookie.split("=")[1],
    "database contains a session hash, not the bearer token",
  );
  const csv =
    'Phone number,Business name,Email address,Industry,Research status,Outreach status,Notes\n(415) 555-2671,Example Studio,hello@example.test,Creative,verified,sent,"<script>alert(1)</script>"\n+14155552671,Duplicate,,,,,\n2025550123,Excluded,excluded@example.test,Food,,do_not_contact,\n123,Bad,not-an-email,,,,\n2125550123,,,,,,phone only';
  const input = { fileName: "cleaned_outreach_leads.csv", csv };
  const preview = await request("/api/import", {
    method: "POST",
    cookie,
    body: input,
  });
  check(
    preview.response.status === 200 &&
      preview.data.ready === 3 &&
      preview.data.duplicates === 1 &&
      preview.data.invalid === 1,
    "CSV preview validates mixed rows and normalized duplicates",
  );
  check(
    (await db.lead.count({ where: { userId: user.id } })) === 0,
    "preview does not persist leads",
  );
  const imported = await request("/api/import", {
    method: "POST",
    cookie,
    body: { ...input, commit: true },
  });
  check(
    imported.data.committed && imported.data.ready === 3,
    "commit persists only valid unique rows",
  );
  const again = await request("/api/import", {
    method: "POST",
    cookie,
    body: input,
  });
  check(
    again.data.ready === 0 && again.data.duplicates === 4,
    "reimport detects existing leads",
  );
  const list = await request("/api/leads?q=Example%20Studio", { cookie });
  const lead = list.data.leads[0];
  check(
    list.data.count === 1 &&
      lead.phone === "+14155552671" &&
      lead.researchStatus === "manual_review" &&
      lead.outreachStatus === "manual_review" &&
      !lead.verifiedAt,
    "search returns real normalized leads without trusting verification claims",
  );
  check(
    (await request("/api/leads?status=unresolved", { cookie })).data.count ===
      1,
    "status filter applies correctly",
  );
  check(
    (await request("/api/leads?q=%27%20OR%201%3D1", { cookie })).data.count ===
      0,
    "search treats SQL-like input as data",
  );
  check(
    (await db.suppression.count({ where: { userId: user.id } })) === 1,
    "import honors do-not-contact instruction",
  );
  const login2 = await request("/api/auth/login", {
    method: "POST",
    body: { email: email2, password },
  });
  const cookie2 = (login2.response.headers.get("set-cookie") || "").split(
    ";",
  )[0];
  check(
    (await request("/api/leads", { cookie: cookie2 })).data.count === 0,
    "second user cannot list another user's leads",
  );
  const edit = {
    businessName: "Updated Studio",
    email: "hello@example.test",
    website: "example.test",
    industry: "Creative",
    state: "CA",
    source: "Authorized test fixture",
    notes: "=FORMULA",
    doNotContact: true,
  };
  check(
    (
      await request(`/api/leads/${lead.id}`, {
        method: "PATCH",
        cookie: cookie2,
        body: edit,
      })
    ).response.status === 404,
    "cross-user lead edits denied",
  );
  check(
    (
      await request(`/api/leads/${lead.id}`, {
        method: "PATCH",
        cookie,
        origin: "https://evil.example",
        body: edit,
      })
    ).response.status === 403,
    "cross-origin mutations denied",
  );
  check(
    (
      await request(`/api/leads/${lead.id}`, {
        method: "PATCH",
        cookie,
        body: edit,
      })
    ).data.lead.businessName === "Updated Studio",
    "lead editing persists fields",
  );
  check(
    (await db.suppression.count({ where: { userId: user.id } })) === 2,
    "manual exclusion adds suppression entry",
  );
  check(
    (
      await request(`/api/leads/${lead.id}`, {
        method: "PATCH",
        cookie,
        body: { ...edit, doNotContact: false },
      })
    ).response.status === 400,
    "existing exclusion cannot be cleared accidentally",
  );
  const exported = await request("/api/leads/export", { cookie });
  check(
    exported.response.status === 200 &&
      exported.text.includes("'=FORMULA") &&
      exported.text.includes("'+14155552671"),
    "CSV export neutralizes spreadsheet formulas",
  );
  const setting = {
    senderName: "Max",
    postalAddress: "Test address, not for sending",
    mode: "draft_only",
    monthlyBudget: 0,
  };
  check(
    (await request("/api/settings", { method: "PATCH", cookie, body: setting }))
      .data.settings.mode === "draft_only",
    "workspace settings persist without paid services",
  );
  check(
    (
      await request("/api/settings", {
        method: "PATCH",
        cookie,
        body: { ...setting, mode: "auto_send" },
      })
    ).response.status === 400,
    "unsupported sending mode rejected",
  );
  for (const path of [
    "/",
    "/leads",
    "/settings",
    "/analytics",
    "/research",
    "/discovery",
    "/pitches",
    "/campaigns",
    "/inbox",
    "/clients",
  ])
    check(
      (await request(path, { cookie })).response.status === 200,
      `${path} renders for authenticated user`,
    );
  check(
    (await db.auditLog.count({ where: { userId: user.id } })) >= 4,
    "important mutations create audit records",
  );
  const concurrentBody = {
    fileName: "concurrent.csv",
    csv: "phone\n3035550123",
    commit: true,
  };
  const concurrent = await Promise.all([
    request("/api/import", { method: "POST", cookie, body: concurrentBody }),
    request("/api/import", { method: "POST", cookie, body: concurrentBody }),
  ]);
  check(
    concurrent.filter((r) => r.response.status === 200).length === 1 &&
      (await db.lead.count({
        where: { userId: user.id, phone: "+13035550123" },
      })) === 1,
    "concurrent imports cannot duplicate a lead",
  );
  const raw = cookie.split("=")[1];
  await db.session.update({
    where: { id: createHash("sha256").update(raw).digest("hex") },
    data: { expiresAt: new Date(0) },
  });
  check(
    (await request("/api/leads", { cookie })).response.status === 401,
    "expired session denied",
  );
  const login3 = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const cookie3 = (login3.response.headers.get("set-cookie") || "").split(
    ";",
  )[0];
  check(
    (await request("/api/auth/logout", { method: "POST", cookie: cookie3 }))
      .response.status === 200 &&
      (await request("/api/leads", { cookie: cookie3 })).response.status ===
        401,
    "logout revokes server-side session",
  );
  let throttled = false;
  for (let i = 0; i < 11; i++)
    if (
      (
        await request("/api/auth/login", {
          method: "POST",
          body: { email: email2, password: "wrong" },
        })
      ).response.status === 429
    ) {
      throttled = true;
      break;
    }
  check(throttled, "repeated login attempts are throttled in PostgreSQL");
  console.log(
    `\n${passed} integration checks passed. Test accounts and records will be removed.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.user.deleteMany({ where: { email: { in: [email, email2] } } });
    await db.loginAttempt.deleteMany({
      where: {
        key: {
          in: [email, email2].map((e) =>
            createHash("sha256").update(e).digest("hex"),
          ),
        },
      },
    });
    await db.$disconnect();
  });
