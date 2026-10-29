import { test, expect } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/password";
const email = `research-browser-${randomUUID()}@example.test`,
  password = randomUUID();
test.beforeAll(async () => {
  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
  const lead = await db.lead.create({
    data: {
      userId: user.id,
      phone: "+14155552671",
      website: "https://fixture-studio.com/",
    },
  });
  const date = new Date().toISOString(),
    source = "https://fixture-studio.com/contact",
    published = "hello@fixture-studio.com";
  await db.researchBatch.create({
    data: {
      userId: user.id,
      status: "completed",
      jobs: {
        create: {
          leadId: lead.id,
          status: "completed",
          attempts: 1,
          candidates: {
            create: {
              businessName: "Synthetic Browser Studio",
              website: "https://fixture-studio.com",
              phoneMatched: true,
              confidence: 90,
              evidence: {
                pages: [
                  {
                    url: source,
                    discoveredAt: date,
                    phoneMatched: true,
                    emails: [published],
                    title: "Synthetic contact-page fixture",
                  },
                ],
                emails: [
                  { email: published, sourceUrl: source, discoveredAt: date },
                ],
                services: "Synthetic test evidence only.",
              },
            },
          },
        },
      },
    },
  });
});
test.afterAll(async () => {
  await db.user.deleteMany({ where: { email } });
  await db.loginAttempt.deleteMany({
    where: { key: createHash("sha256").update(email).digest("hex") },
  });
  await db.$disconnect();
});
test("review source evidence, approve a discovered email and see the verified lead", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.getByRole("link", { name: "Research Agent", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Get to know the business." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Synthetic Browser Studio" }),
  ).toBeVisible();
  await page.getByLabel("Select +14155552671", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Research 1 leads" }),
  ).toBeDisabled();
  await page
    .getByLabel("I have reviewed the source permissions", { exact: false })
    .check();
  await expect(
    page.getByRole("button", { name: "Research 1 leads" }),
  ).toBeEnabled();
  await page
    .getByLabel("Email for https://fixture-studio.com")
    .selectOption("hello@fixture-studio.com");
  await page.screenshot({
    path: "test-results/research-evidence.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm business & save email" })
    .click();
  await expect(page.getByText("Review recorded: approved")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "hello@fixture-studio.com", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Leads", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Verified business", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Email Discovery", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Find the right inbox." }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "hello@fixture-studio.com", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
