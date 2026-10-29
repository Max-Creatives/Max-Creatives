# Phone-to-business research and email discovery

The research workflow, persistent queue and human-review screens are implemented. Tests use synthetic HTML and recorded fixture evidence. A successful live Brave lookup or a match for your imported contacts must not be claimed until a real authorized batch is checked. A search key being present does not prove the subscription is authorized or that a phone will match a business.

## Use the hosted app

1. Get a search key from [Brave Search API](https://api-dashboard.search.brave.com/). Review its current plans, quotas and pricing before subscribing.
2. In Render open **max-outreach-ai → Environment → Add Environment Variable**. Name it **BRAVE_SEARCH_API_KEY** and put its value in Render's secure value field, then save/redeploy. Never put the key in chat, CSV, browser source or lead notes.
3. After the latest application commit is deployed, open **Research Agent**. Confirm that the provider indicator says the key is configured. Start with one lead, not your entire list.
4. Select the lead, review the source-permission acknowledgment, and click **Research … leads**. Keep the page open while processing on the free web service.
5. Inspect each source URL, phone match, date, published description and email. Competing business candidates remain separate. A source without an exact phone match cannot be marked verified.
6. Choose a published email from the dropdown and click **Confirm business & save email**, or reject the finding. No address is guessed. **Email Discovery** lists the latest 25 approved, source-attributed emails; all saved leads remain available through the lead directory.

If a lead already contains the correct HTTPS business website, the app can check that website without a search key. An HTTP-only site is unsupported; no TLS verification is disabled. Research can fail because of source restrictions, robots.txt, inaccessible pages, an unpublished phone/email, ambiguous evidence or an invalid search subscription. Unresolved work remains visible. Public availability does not establish deliverability, ownership, consent, or marketing eligibility.

## Processing and recovery

Select up to 25 leads per batch. Lead and batch-history lists are paginated. Queued work, attempts, leases, candidates, review decisions and logs persist in PostgreSQL. Only unverified, non-excluded leads can be queued; a lead cannot appear in two active/paused batches. The source-permission acknowledgment is recorded in the audit log.

The default free-hosting mode processes one lead per authenticated request while the research page is open. Closing a page may interrupt its request; it does not mean processing will continue indefinitely. Reopen the page, select the saved batch and resume it. Jobs have a 90-second ownership lease; interrupted work is reclaimable after expiry. Requests have a 40-second overall research limit. Transient failures retry at most three times, with backoff; blocked or exhausted work requires explicit retry. Pause prevents another claim; a current page request may finish. Lease tokens prevent an expired processor from writing a later processor's results.

For an always-on service, run `npm run research:worker` in a separately supervised worker process with the same database and server-side provider environment. It handles research only, never sends email. Do not create a paid Render worker silently: the current blueprint deliberately does not provision one. The worker and browser can safely share the queue. Configure worker shutdown/restarts and service costs with your host.

## Sources, security and evidence

Phone-only leads use Brave's documented web-search API with quoted E.164 and national phone forms. Search snippets are not treated as contact evidence. Known protected social/directory destinations are excluded from crawling. Up to two distinct website hosts are checked per lead; the matched page and one same-origin contact/about page are inspected. The homepage URL must be a public HTTPS domain. Cross-origin contact-page redirects are not attributed to the original business.

The crawler checks robots.txt before each source origin, respects disallow rules, rejects uncertain policies/access challenges, does not authenticate or bypass access controls, and limits page sizes, redirects, request rates and time. It does not execute website scripts. Email and phone extraction never joins unrelated DOM text nodes into a fabricated value. JSON-LD organization fields and mailto/tel links can provide explicitly published evidence. Business names are taken only from declared site/organization metadata; missing names remain missing. This conservative implementation can miss valid information rather than guess it.

Every DNS result must be public. IP literals, credentials, internal/reserved addresses, metadata endpoints, non-HTTPS schemes and nonstandard ports are rejected. Direct HTTPS requests pin the validated address and keep TLS hostname/certificate verification enabled. A generic CONNECT proxy cannot preserve that DNS pinning guarantee, so arbitrary website crawling fails closed in such runtimes. The managed coding workspace uses a proxy, so its tests inject synthetic transports. Render normally provides direct HTTPS egress; verify this with a real batch. Fixed-host Brave API calls honor an inherited proxy if one is configured.

An exact phone observation starts at an evidence score of 80, with 5 points each for a declared business name and public contact email. An unmatched page starts at 20, plus 5 for a declared name. These are deterministic evidence scores, not probabilities or proof of uniqueness. All candidates require explicit human review. Approval records the reviewer action, source URL and discovery time; it does not send messages. Suppressed contacts cannot be approved for email discovery, and excluded leads cannot be researched or approved. Separate sending-time compliance checks remain necessary in the future.

## Costs and configuration

- **BRAVE_SEARCH_API_KEY**: optional for lead management/supplied-site checks, required for phone-only search. Server-side only. The presence indicator does not display the key.
- **RESEARCH_MONTHLY_SEARCH_LIMIT**: defaults to 50 attempted searches per workspace per UTC calendar month. Integers 0–10000 are accepted; 0 disables search calls. Invalid settings use the safe default of 50. Retries and provider failures consume an application reservation, so this counter may differ from billed requests. Review Brave's account-side spending/usage controls too.
- The app reserves a request atomically before calling the provider. It never increases the limit automatically. The same provider key can serve multiple separately owned workspaces, each with its own application limit; set a provider-wide cap if needed.
- Supplied-site research makes no search API request. No LLM is used. There is no model-token charge or Gmail sending charge from this feature.
- A paused or manually retried batch can repeat work; no paid-query cache is claimed. Database retention, hosting and an optional worker still have their own costs.

Existing monthly AI budget preferences do not enforce Brave spending. The research-specific request cap is separate. No email-sending functionality is included in this phase.

## Tests and rollout

Run `npm test`, `npm run typecheck`, `npm run build`, then with the app and PostgreSQL running run `npm run test:research` and `npm run test:browser`. These tests check access control, durable claims, lease recovery, pause/retry, evidence selection, suppression, approval and the UI with synthetic records. They do not call the paid search provider or claim a business was found in the real world. The integration fixtures and test accounts are removed afterward.

The SQL migration only adds research tables and relations; it does not delete imported leads, change owner passwords or rewrite existing migrations. The hosted startup applies it before the web process starts. Wait for the Render deployment to say **Live**, then validate one authorized real phone. Confirm its source manually before scaling up. If the deployment fails, preserve the database and inspect its logs; never reset it to make a deploy succeed.
