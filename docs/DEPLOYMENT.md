# Deployment and recovery

## Deployment

Run Next.js on a Node.js 24 host with private PostgreSQL (tested with PostgreSQL 17). Phase 1 needs no Redis, AI API, Gmail, or background worker. Research now has an optional separately supervised worker (`npm run research:worker`); free hosting processes research while its page stays open. Scheduled campaign automation is not implemented.

1. Provision a PostgreSQL database with verified TLS, encryption at rest, restricted access and automated backups.
2. Configure server-side DATABASE*URL and APP_URL, the exact public HTTPS origin. Preview deployments need their own correct APP_URL. Never expose credentials through NEXT_PUBLIC* variables.
3. Run `npm ci` then `npm run db:migrate` in a trusted deployment runner. Migrations require DDL permissions. Use a least-privilege application database role at runtime.
4. Run `npm run build` and `npm start`, with a host-managed PORT if needed. Put the process behind HTTPS and edge rate limiting.
5. Create an owner in a trusted shell using OWNER_EMAIL, OWNER_PASSWORD and `npm run auth:create`. Remove bootstrap password variables afterward. There is no default owner or public signup.
6. Check `/api/health` for HTTP 200 and `{"status":"ok"}`. Validate login, authorized CSV import, editing, settings and logout on staging. An open port is not sufficient readiness evidence.
7. Configure monitoring, resource limits, off-host backups, retention, and recovery procedures. Review SECURITY.md before wider access.

Build with development dependencies available. The tsx migration/account tools belong in the trusted admin/deployment runner and are unavailable after pruning development dependencies. Prisma adapters must remain runtime dependencies.

Application queries use Prisma 7.10.1's binary-free client and PostgreSQL adapter. Client generation invokes the matching version-pinned npm generator/WASM compiler directly to avoid an unused native migration-engine download from the standard CLI. The wrapper uses Prisma's internal generator API; keep all Prisma packages pinned together and revalidate upgrades. No artifact verification is disabled.

Deploy with `npm run db:migrate`: it applies checked-in Prisma-generated SQL with advisory locking, transactions and SHA-256 checksums in `_max_migrations`. Do not mix this with native Prisma Migrate without an explicit baseline. Native CLI schema-diff/migration commands may need access to binaries.prisma.sh; the tested install/start workflow does not.

No cloud provider deployment, domain, TLS certificate, OAuth app, or subscription has been created. Hosting-specific provisioning and publication remain deployment actions. A local build is not a public deployment.

## Backups and restore tests

`npm run db:backup` writes a private custom-format pg_dump archive under ignored `backups/` for the local container. Encrypt and copy backups off-host. Docker volumes and cloud snapshots are not enough for disaster recovery.

For managed PostgreSQL, enable point-in-time recovery where available and schedule logical dumps with provider credentials and verified TLS. Use pg_dump at the same or a newer version than the server. Monitor backup failures and define recovery-point/time objectives.

Test local restores in a new disposable database, never over your live database:

```bash
docker exec max-outreach-db createdb -U max max_outreach_restore_test
# Replace the path with an actual backup filename.
docker exec -i max-outreach-db pg_restore -U max -d max_outreach_restore_test --exit-on-error < backups/YOUR_BACKUP.dump
docker exec max-outreach-db psql -U max -d max_outreach_restore_test -c 'SELECT count(*) FROM "_max_migrations";'
docker exec max-outreach-db dropdb -U max max_outreach_restore_test
```

In production restore to a separate instance, verify the schema, migration ledger, user/lead counts and representative application reads before switching traffic. Retain the previous database through cutover. Revoke sessions after a compromise or sensitive recovery.

Never edit an applied migration or change its checksum. Generate a new reviewed incremental SQL migration, test it and backups on staging, and use forward fixes. Destructive changes need a separate maintenance/recovery plan. Test suites create/delete fixture accounts and must not target production.
