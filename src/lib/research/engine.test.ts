import { describe, expect, it, vi } from "vitest";
import { investigate } from "./engine";
import { ResearchError } from "./safe-web";
const response = (url: string, body: string) => ({
  status: 200,
  url,
  body,
  type: "text/html",
});
const lead = { phone: "+14155552671", country: "US", website: null };
describe("research workflow with synthetic source responses", () => {
  it("searches a quoted phone, checks sources, saves evidence without guessing", async () => {
    const search = vi
      .fn()
      .mockResolvedValue([
        "https://fixture-studio.com/",
        "https://www.yelp.com/business",
        "https://fixture-studio.com/duplicate",
      ]);
    const page = vi
      .fn()
      .mockImplementation(async (url: string) =>
        response(
          url,
          url.endsWith("/contact")
            ? "<body>Call (415) 555-2671. contact@fixture-studio.com</body>"
            : '<html><head><meta property="og:site_name" content="Fixture Studio"></head><body><a href="/contact">Contact us</a></body></html>',
        ),
      );
    const findings = await investigate(lead, AbortSignal.timeout(5000), {
      search,
      page,
    });
    expect(search).toHaveBeenCalledWith(
      expect.stringContaining('"+14155552671"'),
      expect.any(AbortSignal),
    );
    expect(page).toHaveBeenCalledTimes(2);
    expect(findings).toHaveLength(1);
    expect(findings[0].phoneMatched).toBe(true);
    expect(findings[0].confidence).toBe(90);
    expect(findings[0].evidence.emails[0].sourceUrl).toBe(
      "https://fixture-studio.com/contact",
    );
  });
  it("checks a supplied website without using the search provider", async () => {
    const search = vi.fn();
    const findings = await investigate(
      { ...lead, website: "https://fixture-studio.com/" },
      AbortSignal.timeout(1000),
      {
        search,
        page: async (url) => response(url, "<body>Call 202-555-0123</body>"),
      },
    );
    expect(search).not.toHaveBeenCalled();
    expect(findings[0].phoneMatched).toBe(false);
    expect(findings[0].confidence).toBe(20);
  });
  it("leaves no-match numbers unresolved", async () => {
    expect(
      await investigate(lead, AbortSignal.timeout(1000), {
        search: async () => [],
      }),
    ).toEqual([]);
  });
  it("preserves competing exact matches for human review", async () => {
    const findings = await investigate(lead, AbortSignal.timeout(1000), {
      search: async () => [
        "https://first-business.com/",
        "https://second-business.com/",
      ],
      page: async (url) => response(url, "<body>415-555-2671</body>"),
    });
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.phoneMatched)).toBe(true);
  });
  it("does not attribute emails from a contact-page redirect to another business", async () => {
    const findings = await investigate(
      { ...lead, website: "https://fixture-studio.com/" },
      AbortSignal.timeout(1000),
      {
        page: async (url) =>
          url.endsWith("/contact")
            ? response(
                "https://unrelated-business.com/contact",
                "<body>4155552671 other@unrelated-business.com</body>",
              )
            : response(
                url,
                '<body>4155552671<a href="/contact">Contact</a></body>',
              ),
      },
    );
    expect(findings[0].evidence.emails).toEqual([]);
  });
  it("retries transient access failures without inventing successful results", async () => {
    await expect(
      investigate(
        { ...lead, website: "https://fixture-studio.com/" },
        AbortSignal.timeout(1000),
        {
          page: async () => {
            throw new ResearchError("Rate limited", true);
          },
        },
      ),
    ).rejects.toMatchObject({ retryable: true });
  });
});
