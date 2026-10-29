import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import {
  crawler,
  fetchPublicPage,
  publicAddress,
  publicUrl,
  type WebTransport,
} from "./safe-web";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("SSRF protection", () => {
  it("rejects private, loopback, reserved, metadata, mapped private and carrier addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "192.168.1.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
      "168.63.129.16",
      "100.100.100.200",
      "0.0.0.0",
      "224.0.0.1",
    ])
      expect(publicAddress(ip), ip).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it("rejects unsafe schemes, credentials, IP literals, internal domains and nonstandard ports", () => {
    for (const raw of [
      "http://business.com",
      "file:///etc/passwd",
      "https://user:pass@business.com",
      "https://127.1",
      "https://2130706433",
      "https://[::1]",
      "https://business.local",
      "https://business.com:8443",
    ])
      expect(() => publicUrl(raw), raw).toThrow();
    expect(publicUrl("https://business.com/contact#section").toString()).toBe(
      "https://business.com/contact",
    );
  });
  it("fails closed behind a generic proxy instead of weakening DNS protections", async () => {
    vi.stubEnv("HTTPS_PROXY", "http://proxy.invalid:8080");
    await expect(
      fetchPublicPage(
        new URL("https://business.com"),
        AbortSignal.timeout(1000),
      ),
    ).rejects.toThrow("proxy is unsupported");
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects mixed public/private DNS before opening a socket", async () => {
    for (const k of [
      "HTTPS_PROXY",
      "https_proxy",
      "HTTP_PROXY",
      "http_proxy",
      "ALL_PROXY",
      "all_proxy",
    ])
      vi.stubEnv(k, "");
    vi.mocked(lookup).mockResolvedValueOnce([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ] as never);
    await expect(
      fetchPublicPage(
        new URL("https://business.com"),
        AbortSignal.timeout(1000),
      ),
    ).rejects.toThrow("mixed public/private");
    expect(request).not.toHaveBeenCalled();
  });
  it("pins the validated address and retains TLS hostname verification", async () => {
    for (const k of [
      "HTTPS_PROXY",
      "https_proxy",
      "HTTP_PROXY",
      "http_proxy",
      "ALL_PROXY",
      "all_proxy",
    ])
      vi.stubEnv(k, "");
    vi.mocked(lookup).mockResolvedValueOnce([
      { address: "8.8.8.8", family: 4 },
    ] as never);
    vi.mocked(request).mockImplementation(((
      _url: unknown,
      options: any,
      callback: any,
    ) => {
      expect(options.rejectUnauthorized).toBe(true);
      expect(options.servername).toBe("business.com");
      options.lookup(
        "business.com",
        {},
        (_error: unknown, address: string, family: number) => {
          expect(address).toBe("8.8.8.8");
          expect(family).toBe(4);
        },
      );
      const req = new EventEmitter() as any;
      req.setTimeout = () => req;
      req.end = () => {
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        res.headers = { "content-type": "text/html" };
        callback(res);
        res.emit("data", Buffer.from("<body>Checked</body>"));
        res.emit("end");
      };
      return req;
    }) as any);
    expect(
      (
        await fetchPublicPage(
          new URL("https://business.com"),
          AbortSignal.timeout(1000),
        )
      ).status,
    ).toBe(200);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
describe("source access rules", () => {
  beforeEach(() => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => (now += 2000));
  });
  it("honors robots disallow without fetching the protected page", async () => {
    const transport = vi.fn<WebTransport>().mockImplementation(async (url) => ({
      url: url.toString(),
      status: 200,
      type: "text/plain",
      body: "User-agent: *\nDisallow: /private",
    }));
    await expect(
      crawler(
        AbortSignal.timeout(1000),
        transport,
      )("https://business.com/private"),
    ).rejects.toThrow("does not permit");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("does not follow a redirect into a private address", async () => {
    const transport = vi.fn<WebTransport>().mockImplementation(async (url) => ({
      url: url.toString(),
      status: url.pathname === "/robots.txt" ? 404 : 302,
      body: "",
      type: "text/plain",
      location: "https://127.0.0.1/private",
    }));
    await expect(
      crawler(AbortSignal.timeout(1000), transport)("https://business.com/"),
    ).rejects.toThrow("not a public");
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("fails closed when source policy is unavailable", async () => {
    const transport = vi.fn<WebTransport>().mockImplementation(async (url) => ({
      url: url.toString(),
      status: 503,
      type: "text/plain",
      body: "Unavailable",
    }));
    await expect(
      crawler(AbortSignal.timeout(1000), transport)("https://business.com/"),
    ).rejects.toMatchObject({ retryable: true });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("checks robots again after a redirect to a new domain", async () => {
    const visited: string[] = [];
    const transport: WebTransport = async (url) => {
      visited.push(url.toString());
      return url.pathname === "/robots.txt"
        ? { status: 404, url: url.toString(), body: "", type: "text/plain" }
        : url.hostname === "business.com"
          ? {
              status: 302,
              url: url.toString(),
              body: "",
              type: "text/html",
              location: "https://other-business.com/",
            }
          : {
              status: 200,
              url: url.toString(),
              body: "<body>Public</body>",
              type: "text/html",
            };
    };
    expect(
      (
        await crawler(
          AbortSignal.timeout(1000),
          transport,
        )("https://business.com/")
      ).url,
    ).toBe("https://other-business.com/");
    expect(visited).toContain("https://other-business.com/robots.txt");
  });
});
