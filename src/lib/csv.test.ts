import { describe, expect, it } from "vitest";
import { csvCell, normalizePhone, parseLeadCsv, safeWebsite } from "./csv";
describe("phone normalization", () => {
  it("normalizes US national and international formats", () => {
    expect(normalizePhone("(415) 555-2671")).toBe("+14155552671");
    expect(normalizePhone("1-415-555-2671")).toBe("+14155552671");
    expect(normalizePhone("+44 20 7946 0958", "GB")).toBe("+442079460958");
  });
  it("rejects short, malformed, and extension-bearing numbers", () => {
    for (const raw of [
      "123",
      "call me",
      "4155552671 ext 4",
      "4155552671<script>",
    ])
      expect(normalizePhone(raw)).toBeNull();
  });
});
describe("CSV import", () => {
  it("accepts headered and headerless phone-only files", () => {
    expect(parseLeadCsv("Phone number\n(415) 555-2671").ready).toBe(1);
    expect(parseLeadCsv("4155552671\n2025550123").ready).toBe(2);
  });
  it("detects duplicates across formats and existing workspace data", () => {
    const r = parseLeadCsv(
      "phone,email\n4155552671,a@example.test\n+14155552671,b@example.test\n2025550123,a@example.test\n2125550123,c@example.test",
      new Set(["+12125550123"]),
    );
    expect([r.ready, r.duplicates, r.invalid]).toEqual([1, 3, 0]);
  });
  it("reports invalid rows without dropping valid neighbors", () => {
    const r = parseLeadCsv(
      "phone,email\n4155552671,valid@example.test\n123,nope\n2025550123,other@example.test",
    );
    expect(r.ready).toBe(2);
    expect(r.invalid).toBe(1);
    expect(r.rows[1].row).toBe(3);
    expect(r.rows[1].errors).toHaveLength(2);
  });
  it("supports BOM, quoted fields, aliases, unknown columns and US country names", () => {
    const r = parseLeadCsv(
      '\uFEFFPhone Number,Company Name,Notes,Country,custom\r\n4155552671,"Studio, Inc.","First line\nsecond line",USA,value',
    );
    expect(r.rows[0].lead?.businessName).toBe("Studio, Inc.");
    expect(r.rows[0].lead?.notes).toContain("\n");
    expect(r.ignoredColumns).toEqual(["custom"]);
  });
  it("does not trust imported claims of verification or delivery", () => {
    const r = parseLeadCsv(
      "phone,business name,email,research status,outreach status\n4155552671,Example,a@example.test,verified,sent",
    );
    expect(r.rows[0].lead?.researchStatus).toBe("manual_review");
    expect(r.rows[0].lead?.outreachStatus).toBe("manual_review");
    expect(r.rows[0].warnings).toHaveLength(2);
  });
  it("preserves do-not-contact instructions", () => {
    expect(
      parseLeadCsv("phone,outreach status\n4155552671,do_not_contact").rows[0]
        .lead?.outreachStatus,
    ).toBe("do_not_contact");
  });
  it("rejects bad date, invalid country and malformed URLs", () => {
    expect(
      parseLeadCsv(
        "phone,last contact date,country,website\n4155552671,2026-02-30,ZZ,javascript:alert(1)",
      ).invalid,
    ).toBe(1);
  });
  it("rejects missing, duplicated, empty, malformed and excessive input", () => {
    for (const input of [
      "",
      "email\na@example.test",
      "phone",
      "phone,phone number\n4155552671,2025550123",
      'phone,notes\n4155552671,"unclosed',
      "phone\n" + "4155552671\n".repeat(2001),
      "a".repeat(2 * 1024 * 1024 + 1),
    ])
      expect(() => parseLeadCsv(input)).toThrow();
  });
  it("rejects column-count mismatches", () => {
    expect(
      parseLeadCsv("phone,email\n4155552671,a@example.test,extra").invalid,
    ).toBe(1);
  });
});
describe("safe output", () => {
  it("rejects executable and credential-bearing links", () => {
    expect(safeWebsite("javascript:alert(1)")).toBeNull();
    expect(safeWebsite("https://user:password@example.test")).toBeNull();
    expect(safeWebsite("example.test")).toBe("https://example.test/");
  });
  it("neutralizes spreadsheet formulas and quotes cells", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"');
    expect(csvCell('one,"two"')).toBe('"one,""two"""');
    expect(csvCell("+14155552671")).toBe('"\'+14155552671"');
  });
  it("reimports spreadsheet-safe E.164 phones", () => {
    expect(
      parseLeadCsv(`Phone\n${csvCell("+14155552671")}`).rows[0].lead?.phone,
    ).toBe("+14155552671");
  });
});
