import { expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
it("stores salted hashes and verifies only the correct password", async () => {
  const a = await hashPassword("test-only-password"),
    b = await hashPassword("test-only-password");
  expect(a).not.toBe(b);
  expect(a).not.toContain("test-only-password");
  expect(await verifyPassword("test-only-password", a)).toBe(true);
  expect(await verifyPassword("wrong", a)).toBe(false);
  expect(await verifyPassword("wrong", "invalid")).toBe(false);
});
