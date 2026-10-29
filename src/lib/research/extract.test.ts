import { describe, expect, it } from "vitest";
import { extractPage } from "./extract";
const html = `<html><head><title>Fixture Studio contact</title><meta name="description" content="Product films and photography."><script type="application/ld+json">{"@type":"LocalBusiness","name":"Fixture Studio","telephone":"(415) 555-2671"}</script></head><body><a href="mailto:hello@fixture-studio.com?subject=Hello">Email us</a><a href="/contact">Contact</a><p>Call (415) 555-2671.</p><p>privacy@fixture-studio.com noreply@fixture-studio.com</p><script>var email="hidden@tracker.com";</script></body></html>`;
describe("source-grounded extraction (synthetic HTML, no live research)", () => {
  it("finds exact phone, published business name, email and evidence date", () => {
    const result = extractPage(
      html,
      "https://fixture-studio.com/",
      "+14155552671",
    );
    expect(result.businessName).toBe("Fixture Studio");
    expect(result.description).toBe("Product films and photography.");
    expect(result.evidence.phoneMatched).toBe(true);
    expect(result.evidence.emails).toEqual(["hello@fixture-studio.com"]);
    expect(result.evidence.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.contactLinks).toEqual(["https://fixture-studio.com/contact"]);
  });
  it("does not invent a business name or infer a matching phone from unrelated numbers", () => {
    const result = extractPage(
      "<html><title>A directory</title><body>Phone 202-555-0123. No emails supplied.</body></html>",
      "https://fixture-studio.com/",
      "+14155552671",
    );
    expect(result.businessName).toBeNull();
    expect(result.evidence.phoneMatched).toBe(false);
    expect(result.evidence.emails).toEqual([]);
  });
  it("ignores executable scripts and off-site contact links", () => {
    const result = extractPage(
      html +
        '<a href="https://another-site.com/contact">Contact other business</a><a href="javascript:alert(1)">Contact</a>',
      "https://fixture-studio.com/",
      "+14155552671",
    );
    expect(result.evidence.emails).not.toContain("hidden@tracker.com");
    expect(result.contactLinks).toEqual(["https://fixture-studio.com/contact"]);
  });
  it("handles malformed structured data without fabricating an organization", () => {
    expect(
      extractPage(
        '<script type="application/ld+json">not json</script><body>No organization</body>',
        "https://fixture-studio.com/",
        "+14155552671",
      ).businessName,
    ).toBeNull();
  });
  it("never assembles a phone or email by joining unrelated DOM nodes", () => {
    const result = extractPage(
      "<body><p>415</p><p>5552671</p><p>sales</p><p>@fixture-studio.com</p><p>555-2671.</p><p>privacy@fixture-studio.com</p></body>",
      "https://fixture-studio.com/",
      "+14155552671",
    );
    expect(result.evidence.phoneMatched).toBe(false);
    expect(result.evidence.emails).toEqual([]);
  });
});
