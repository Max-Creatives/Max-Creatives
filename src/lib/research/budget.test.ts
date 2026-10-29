import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), updateMany: vi.fn() }));
vi.mock("../db", () => ({ db: { searchUsage: mocks } }));
vi.mock("../http", () => ({ HttpError: class extends Error {} }));
import { reserveSearch, searchLimit } from "./queue";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("uses a bounded safe limit and honors zero to disable paid searches", () => {
  for (const [value, expected] of [
    [undefined, 50],
    ["0", 0],
    ["25", 25],
    ["10000", 10000],
    ["-1", 50],
    ["1.5", 50],
    ["10001", 50],
    ["bad", 50],
  ] as const) {
    vi.stubEnv("RESEARCH_MONTHLY_SEARCH_LIMIT", value);
    expect(searchLimit()).toBe(expected);
  }
});
it("reserves a search atomically within the owner and UTC month", async () => {
  vi.stubEnv("RESEARCH_MONTHLY_SEARCH_LIMIT", "7");
  mocks.upsert.mockResolvedValue({});
  mocks.updateMany.mockResolvedValue({ count: 1 });
  await reserveSearch("owner-fixture");
  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: {
      userId: "owner-fixture",
      month: new Date().toISOString().slice(0, 7),
      requests: { lt: 7 },
    },
    data: { requests: { increment: 1 } },
  });
});
it("blocks the research call when a request cannot be reserved", async () => {
  vi.stubEnv("RESEARCH_MONTHLY_SEARCH_LIMIT", "0");
  mocks.upsert.mockResolvedValue({});
  mocks.updateMany.mockResolvedValue({ count: 0 });
  await expect(reserveSearch("owner-fixture")).rejects.toThrow(
    "Monthly search-request limit reached",
  );
});
