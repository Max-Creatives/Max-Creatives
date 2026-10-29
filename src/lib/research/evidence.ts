import { z } from "zod";
export const candidateEvidence = z.object({
  pages: z.array(
    z.object({
      url: z.url(),
      discoveredAt: z.iso.datetime(),
      phoneMatched: z.boolean(),
      emails: z.array(z.email()),
      title: z.string().nullable(),
    }),
  ),
  emails: z.array(
    z.object({
      email: z.email(),
      sourceUrl: z.url(),
      discoveredAt: z.iso.datetime(),
    }),
  ),
  services: z.string().nullable(),
});
