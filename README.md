# Max Outreach AI

A private lead workspace for an AI video creator, built with Next.js, TypeScript, Tailwind CSS, shadcn/ui-style components, PostgreSQL and Prisma ORM.

**Phase 1 is implemented:** authentication, CSV preview/import, persisted lead dashboard, search/filter/pagination, editing, spreadsheet-safe export, contact exclusion, settings, basic analytics and audit records. These features require no paid AI or email services. Future module pages are explicitly labeled; they do not simulate research, generated pitches, or Gmail activity.

This was originally a GitHub profile repository. Its profile text is preserved in [docs/PROFILE.md](docs/PROFILE.md).

## Setup

For browser-based hosting without terminal commands, use the prepared [Render deployment](docs/RENDER.md). A hosting account and the application source on GitHub are required; this configuration alone is not a live site.

Requires Node.js 24, npm and a running local Docker daemon. Use the existing checkout in isolated cloud tasks; no extra worktree is needed.

```bash
npm ci
npm run db:local
npm run db:migrate
```

`db:local` creates an ignored, private `.env` with a random database password only when no `.env` exists. It starts/reuses `max-outreach-db` with the persistent `max-outreach-postgres` volume, binds 5432 to loopback, and checks a real database query. It never replaces an existing `.env` or deletes a volume. Preserve `.env` with the volume: changing the file alone does not rotate an initialized database password.

For an external PostgreSQL database, copy `.env.example` to `.env`, configure DATABASE_URL and APP_URL, and run migrations. The local helper leaves external databases alone. Use provider-supported verified TLS settings; do not disable certificate verification.

Create your administrator account in Bash without putting its password in shell history:

```bash
read -r -p "Owner email: " OWNER_EMAIL
read -r -s -p "Owner password (12+ characters): " OWNER_PASSWORD
echo
export OWNER_EMAIL OWNER_PASSWORD
npm run auth:create
unset OWNER_EMAIL OWNER_PASSWORD
npm run dev
```

There is no default password, public signup, or permanent demo account. Account creation refuses to overwrite existing credentials. Each account has its own workspace; shared-team roles are not implemented.

APP*URL defaults to `http://localhost:3000` for local use. **Set it to the exact origin used in your browser**; mutations reject other origins. HTTPS origins receive a Secure session cookie. Use your hosting platform's supported access mechanism for online use. Never put secrets in NEXT_PUBLIC* variables.

For production builds:

```bash
npm run build
npm start
```

Restored cloud tasks may need `npm run db:local` and a new application process; running processes are not retained. A filesystem snapshot is not a substitute for backups or a tested fresh-task restore. Read [deployment instructions](docs/DEPLOYMENT.md) and [security boundaries](SECURITY.md) before publishing online.

## CSV import

Choose **Import leads**, upload a file, inspect the preview/report, then explicitly confirm its valid rows. The existing `cleaned_outreach_leads.csv` can be selected through this uploader; that file was not supplied with the brief and is not bundled.

- UTF-8 comma-delimited CSV, up to 2 MB and 2,000 rows. Quoted fields and embedded newlines work.
- Required: Phone or Phone number. A headerless one-column file is accepted if its first row is a valid phone number.
- Optional: business name, website, email address, industry, country, state, lead source, source URL, research status, outreach status, last contact date, notes. Common company/telephone aliases are recognized. Unknown columns are reported and ignored.
- US national numbers normalize to E.164. International numbers can use E.164 or a supported two-letter country code. Extensions require manual cleanup.
- Normalized phones and lowercased emails are deduplicated within the file and workspace. Invalid rows are excluded. Existing leads are not overwritten; repeated imports do not duplicate them.
- Dates use YYYY-MM-DD. Invalid phones, emails, country codes, URLs, oversized fields, malformed CSV and column-count mismatches are reported.
- Supplied business details remain unverified. Imported verified/sent labels become review states; they never establish business identity or email delivery. Phone-only contacts remain unresolved.
- A do_not_contact status on a new valid lead excludes it and suppresses its email. **Skipped duplicate rows do not change existing records**: apply new exclusions through the existing lead's edit dialog.
- Exports include at most 50,000 leads and prefix formula-like values with an apostrophe for spreadsheet safety. Exported E.164 phones can be re-imported; other formula-like text may retain its safety prefix.

The [CSV template](public/lead-import-template.csv) contains only headers, not fake contacts. Empty dashboard metrics are real empty states. Email counts represent imported addresses, not discovered/verified contacts.

## Validation

```bash
npm run typecheck
npm test
npm run build
# With PostgreSQL migrated and the app running:
npm run test:integration
npm run test:browser
```

Unit tests cover normalization, CSV errors, duplicates, untrusted statuses, formula safety and password hashing. Integration tests use real HTTP and PostgreSQL with temporary accounts, checking isolation, CSRF, sessions, suppression, export, settings and pages. Browser tests exercise login, actual CSV preview/report/import, editing, filters, mobile navigation and logout. Fixture accounts and records are removed afterward. Do not target production with these suites.

Browser tests use `/usr/bin/chromium` by default; set CHROMIUM_PATH on other machines. TEST_BASE_URL overrides the test target and should match APP_URL for origin checks. Ignored screenshots/traces in `test-results/` may contain test contact data.

## Database and migrations

The Prisma schema defines users, hashed sessions, throttling records, leads, imports, settings, suppressions and audit logs. Workspace queries are owner-scoped. Phone and non-null email are unique per owner. Raw CSV is not retained. Preview and commit both validate on the server; imports use serializable transactions with bounded conflict retries.

Prisma 7.10.1's binary-free query client uses `@prisma/adapter-pg`. `npm run db:generate` invokes Prisma's version-pinned npm generator and WASM compiler directly. The standard CLI eagerly downloads a native migration engine even for generation; the wrapper avoids that unused download. All generator/ORM packages are pinned together. This uses Prisma's internal generator API, so upgrades require revalidating generation and the app. Package integrity and TLS verification remain enabled.

Use **`npm run db:migrate`**, not `prisma migrate deploy`. The project runner applies checked-in Prisma-generated SQL through pg with transactions, an advisory lock and SHA-256 checksums in `_max_migrations`. It rejects edited/missing applied migrations and can be repeated safely. This ledger is separate from `_prisma_migrations`; switching runners needs a deliberate baseline.

For future schema changes, generate a new incremental SQL migration with Prisma migrate diff (native CLI tooling may require binaries.prisma.sh network access), review it and test staging first. Never regenerate applied files. Client generation runs during npm ci and via `npm run db:generate`. The tested workflow needs no native engine downloads and keeps integrity/TLS verification enabled.

`npm run db:backup` produces a private, ignored custom-format local pg_dump archive. Schedule encrypted off-host backups and restore tests in production; see [recovery instructions](docs/DEPLOYMENT.md).

## Delivery phases and credentials

| Phase | Scope                                                | Status and prerequisites                                                                                      |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1     | Database, auth, import and lead dashboard            | Implemented; needs PostgreSQL and your administrator account                                                  |
| 2     | Business research and email discovery                | Not implemented; needs permitted public data/search and website access                                        |
| 3     | AI pitches and approval queue                        | Not implemented; needs separately billed OpenAI API access or a reachable local model                         |
| 4     | Gmail OAuth, drafts, safeguards and replies          | Not implemented; needs Google OAuth credentials/account authorization, opt-out handling and compliance review |
| 5     | Durable jobs, retries, schedules, campaign analytics | Not implemented; basic import analytics and deployment instructions are included in Phase 1                   |

No Twilio, n8n, Make, Zapier or WhatsApp is used. Public email availability does not automatically authorize marketing. No sending endpoint exists. Postal address, workspace mode and budget are saved planning preferences, not a completed compliance engine, spend enforcement or working agent. Gmail token encryption must be implemented before storing any OAuth credentials.

## Costs

- Lead management needs no model, search or email API subscription. Installed components are open source; review licenses for your use.
- Hosting still requires compute, PostgreSQL storage, backups and usually a domain. Free managed tiers have limits and may sleep. Check current provider pricing; a small paid deployment may cost roughly $10–$40/month before usage/backups, depending on provider.
- Future OpenAI API billing is **separate from ChatGPT subscriptions**. Local models avoid per-token charges but need hardware, RAM, electricity and possibly paid GPU hosting.
- Search/business data may incur per-query fees and has source-specific terms. Gmail has account quotas, policies and OAuth verification requirements even if API access has no separate per-message charge.
- Budget preferences do not yet enforce spend. Phase 1 makes no AI, search or email-provider calls.

This phase is a tested foundation, not the completed outreach automation platform.
