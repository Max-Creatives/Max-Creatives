import * as cheerio from "cheerio";
import { findPhoneNumbersInText, type CountryCode } from "libphonenumber-js";
import { z } from "zod";
import { publicUrl } from "./safe-web";
export type PageEvidence = {
  url: string;
  discoveredAt: string;
  phoneMatched: boolean;
  emails: string[];
  title: string | null;
};
export type CandidateEvidence = {
  pages: PageEvidence[];
  emails: { email: string; sourceUrl: string; discoveredAt: string }[];
  services: string | null;
};
export type Finding = {
  businessName: string | null;
  website: string;
  phoneMatched: boolean;
  confidence: number;
  evidence: CandidateEvidence;
};
const excludedLocal =
  /^(noreply|no-reply|abuse|privacy|security|legal|example|test|sentry)([+._-]|$)/i;
export function extractPage(
  html: string,
  url: string,
  phone: string,
  country = "US",
) {
  const $ = cheerio.load(html);
  const declaredName = $('meta[property="og:site_name"]')
    .attr("content")
    ?.trim()
    .slice(0, 200);
  let structuredName: string | null = null;
  const telephone: string[] = [],
    structuredEmails: string[] = [];
  let visited = 0;
  function visit(value: unknown, depth = 0) {
    if (++visited > 1000 || depth > 10 || !value || typeof value !== "object")
      return;
    if (Array.isArray(value)) {
      value.slice(0, 100).forEach((v) => visit(v, depth + 1));
      return;
    }
    const node = value as Record<string, unknown>;
    const types = Array.isArray(node["@type"])
      ? node["@type"].join(" ")
      : String(node["@type"] || "");
    if (
      /Organization|LocalBusiness|Store|Restaurant|Dentist|ProfessionalService|Corporation|Hotel/i.test(
        types,
      )
    ) {
      if (!structuredName && typeof node.name === "string")
        structuredName = node.name.slice(0, 200);
      if (typeof node.telephone === "string") telephone.push(node.telephone);
      if (typeof node.email === "string")
        structuredEmails.push(node.email.replace(/^mailto:/i, ""));
    }
    Object.values(node).forEach((v) => visit(v, depth + 1));
  }
  $('script[type="application/ld+json"]')
    .slice(0, 15)
    .each((_i, el) => {
      try {
        visit(JSON.parse($(el).text()));
      } catch {}
    });
  $(
    'script,style,noscript,template,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"]',
  ).remove();
  // Never join separate DOM text nodes into a new phone number or email address.
  const texts: string[] = [];
  $("body")
    .find("*")
    .addBack()
    .contents()
    .each((_i, node) => {
      if (node.type === "text" && texts.length < 10000)
        texts.push(node.data.slice(0, 5000));
    });
  $('a[href^="tel:"]').each((_i, el) => {
    telephone.push(($(el).attr("href") || "").slice(4));
  });
  const phoneMatched = [...telephone, ...texts].some((text) =>
    findPhoneNumbersInText(text, country as CountryCode).some(
      (n) => n.number.number === phone,
    ),
  );
  const emails = new Set<string>(structuredEmails);
  $('a[href^="mailto:"]').each((_i, el) => {
    const raw = ($(el).attr("href") || "").slice(7).split("?")[0];
    try {
      emails.add(decodeURIComponent(raw));
    } catch {}
  });
  for (const text of texts)
    for (const email of text.match(
      /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,63}/gi,
    ) || [])
      emails.add(email);
  const validEmails = [...emails]
    .map((e) => e.trim().toLowerCase())
    .filter(
      (e) =>
        e.length <= 254 &&
        z.email().safeParse(e).success &&
        !excludedLocal.test(e.split("@")[0]) &&
        !/\.(png|jpg|jpeg|webp|svg|css|js)$/i.test(e) &&
        !/@(example\.(com|org|net)|.*\.example|.*\.test)$/i.test(e),
    )
    .slice(0, 12);
  const contactLinks: string[] = [];
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") || "";
    if (!/contact|about|reach|get.in.touch/i.test(`${href} ${$(el).text()}`))
      return;
    try {
      const target = publicUrl(new URL(href, url).toString());
      if (target.origin === new URL(url).origin && target.href !== url)
        contactLinks.push(target.href);
    } catch {}
  });
  const title = $("title").text().trim().slice(0, 200) || null;
  const name = structuredName || declaredName || null;
  const description =
    $('meta[name="description"]').attr("content")?.trim().slice(0, 500) || null;
  return {
    businessName: name,
    description,
    contactLinks: [...new Set(contactLinks)].slice(0, 1),
    evidence: {
      url,
      discoveredAt: new Date().toISOString(),
      phoneMatched,
      emails: [...new Set(validEmails)],
      title,
    } satisfies PageEvidence,
  };
}
