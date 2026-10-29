#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
mkdir -p backups
backup_path="$(mktemp "backups/max-outreach-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump")"
if env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
  docker --host=unix:///var/run/docker.sock exec max-outreach-db pg_dump -U max -d max_outreach --format=custom > "$backup_path"; then
  echo "Backup saved: $backup_path"
else
  rm -f "$backup_path"
  echo "Backup failed. No incomplete archive retained." >&2
  exit 1
fi
