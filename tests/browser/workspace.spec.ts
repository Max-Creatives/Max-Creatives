import { test, expect } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/password";
const email = `browser-${randomUUID()}@example.test`,
  password = `Browser-${randomUUID()}`;
test.beforeAll(async () => {
  await db.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
});
test.afterAll(async () => {
  await db.user.deleteMany({ where: { email } });
  await db.loginAttempt.deleteMany({
    where: { key: createHash("sha256").update(email).digest("hex") },
  });
  await db.$disconnect();
});
test("sign in, import preview, lead editing, responsive navigation and logout", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Good things start with a connection." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Import leads", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Upload leads CSV")
    .setInputFiles({
      name: "cleaned_outreach_leads.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Phone number,Business name,Email address\n4155552671,Browser Test Studio,studio@example.test\n123,Invalid,nope\n+14155552671,Duplicate,",
      ),
    });
  await expect(
    page.getByRole("button", { name: "Import 1 valid leads" }),
  ).toBeEnabled();
  await expect(
    page.getByText("Invalid email address.", { exact: false }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download validation report" })
    .click();
  expect((await download).suggestedFilename()).toBe("import-report.csv");
  await page.getByRole("button", { name: "Import 1 valid leads" }).click();
  await expect(
    page.getByRole("heading", { name: "1 leads imported" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View leads", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Browser Test Studio US" }),
  ).toBeVisible();
  await page.getByLabel("Edit Browser Test Studio").click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Updated Browser Studio");
  await page.getByLabel("Do not contact this lead").check();
  await page.getByRole("button", { name: "Save lead", exact: true }).click();
  await expect(
    page.getByText("Updated Browser Studio", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Do not contact", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search leads").fill("no such business");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No leads match these filters" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(
    page.getByText("Updated Browser Studio", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/leads-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Open navigation").click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good things start with a connection." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Max." }),
  ).toBeVisible();
});
