import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import robotsParser from "robots-parser";

export const AGENT = "MaxOutreachResearch/1.0";
export class ResearchError extends Error {
  constructor(
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
export function publicAddress(address: string) {
  try {
    return (
      ipaddr.process(address).range() === "unicast" &&
      address !== "168.63.129.16"
    );
  } catch {
    return false;
  }
}
export function publicUrl(raw: string) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new ResearchError(
      "Only public HTTPS websites on port 443 are supported.",
    );
  const host = url.hostname.toLowerCase();
  if (
    isIP(host.replace(/^\[|\]$/g, "")) ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
    /\.(local|localhost|internal|test|invalid|example|onion)$/.test(host)
  )
    throw new ResearchError(
      "This website address is not a public business domain.",
    );
  url.hash = "";
  return url;
}
export type WebResponse = {
  status: number;
  url: string;
  body: string;
  location?: string;
  type: string;
};
export type WebTransport = (
  url: URL,
  signal: AbortSignal,
) => Promise<WebResponse>;
export async function fetchPublicPage(
  url: URL,
  signal: AbortSignal,
): Promise<WebResponse> {
  publicUrl(url.toString());
  // A generic CONNECT proxy resolves destinations remotely, defeating DNS pinning.
  // Fail closed for arbitrary website crawling; fixed-host search uses its proxy route.
  if (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy
  )
    throw new ResearchError(
      "Website research requires direct verified HTTPS egress with DNS pinning; this runtime's generic proxy is unsupported.",
    );
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((item) => !publicAddress(item.address))
  )
    throw new ResearchError(
      "Website resolves to a private, reserved, or mixed public/private address.",
    );
  signal.throwIfAborted();
  const chosen = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        signal,
        rejectUnauthorized: true,
        servername: url.hostname,
        family: chosen.family,
        lookup: (_host, _options, callback) =>
          callback(null, chosen.address, chosen.family),
        headers: {
          "User-Agent": AGENT,
          Accept: "text/html,text/plain;q=0.9",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const type = String(res.headers["content-type"] || "");
        const location = res.headers.location;
        if (
          res.headers["content-encoding"] &&
          res.headers["content-encoding"] !== "identity"
        ) {
          res.destroy();
          reject(new ResearchError("Unsupported compressed website response."));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 512 * 1024) {
            res.destroy();
            reject(
              new ResearchError(
                "Website response exceeds the research size limit.",
              ),
            );
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            url: url.toString(),
            body: Buffer.concat(chunks).toString("utf8"),
            location,
            type,
          }),
        );
        res.on("error", () =>
          reject(
            new ResearchError("Website connection was interrupted.", true),
          ),
        );
      },
    );
    req.setTimeout(8000, () => req.destroy(new Error("timeout")));
    req.on("error", () =>
      reject(
        new ResearchError(
          "Website could not be reached with verified HTTPS.",
          true,
        ),
      ),
    );
    req.end();
  });
}
export function crawler(
  signal: AbortSignal,
  transport: WebTransport = fetchPublicPage,
) {
  const policies = new Map<string, ReturnType<typeof robotsParser>>();
  let lastRequest = 0;
  async function get(url: URL) {
    const delay = Math.max(0, 1000 - (Date.now() - lastRequest));
    if (delay)
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new ResearchError("Research time limit reached."));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, delay);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
    signal.throwIfAborted();
    lastRequest = Date.now();
    return transport(url, signal);
  }
  async function allowed(url: URL) {
    let policy = policies.get(url.origin);
    if (!policy) {
      const robotsUrl = new URL("/robots.txt", url.origin);
      const response = await get(robotsUrl);
      if (response.status === 404)
        policy = robotsParser(robotsUrl.toString(), "");
      else if (response.status === 200 && /text\/plain/i.test(response.type))
        policy = robotsParser(robotsUrl.toString(), response.body);
      else
        throw new ResearchError(
          "Website access policy could not be confirmed; no pages were crawled.",
          response.status >= 500 || response.status === 429,
        );
      policies.set(url.origin, policy);
    }
    if (policy.isAllowed(url.toString(), AGENT) === false)
      throw new ResearchError(
        "Website robots.txt does not permit this research path.",
      );
    const delay = policy.getCrawlDelay(AGENT);
    if (delay && delay > 1)
      throw new ResearchError(
        "Website requests a slower crawl rate; use manual review for this source.",
      );
  }
  return async function fetchPage(raw: string): Promise<WebResponse> {
    let url = publicUrl(raw);
    for (let redirects = 0; redirects <= 3; redirects++) {
      await allowed(url);
      const response = await get(url);
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        response.location
      ) {
        url = publicUrl(new URL(response.location, url).toString());
        continue;
      }
      if (response.status === 429 || response.status >= 500)
        throw new ResearchError(
          "Website is temporarily unavailable or rate-limited.",
          true,
        );
      if (response.status !== 200)
        throw new ResearchError(
          `Website returned HTTP ${response.status}; access controls were respected.`,
        );
      if (!/text\/html|application\/xhtml\+xml/i.test(response.type))
        throw new ResearchError("Source is not a supported HTML contact page.");
      return { ...response, url: url.toString() };
    }
    throw new ResearchError("Website redirected too many times.");
  };
}
