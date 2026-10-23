#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Refuse to touch any existing service; this runner owns its temporary cluster.
if pg_isready -h 127.0.0.1 -p 55432 >/dev/null 2>&1; then
  echo "Port 55432 is occupied. Stop the disposable test server before running."
  exit 1
fi
root="$(mktemp -d /tmp/office-reviewer-tests.XXXXXX)"
cleanup() {
  pg_ctl -D "$root/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$root"
}
trap cleanup EXIT
mkdir "$root/socket"
initdb -D "$root/data" -A trust --no-locale >/dev/null
pg_ctl -D "$root/data" -l "$root/server.log" \
  -o "-p 55432 -k $root/socket -h 127.0.0.1" start >/dev/null
npx vitest run --config tests/office-reviewer.config.ts \
  tests/officeReviewerRoleSelect.test.ts tests/officeReviewerIntegration.test.ts \
  server/modules/jobs/__tests__/jobFrequencyUpdate.test.ts \
  server/modules/jobs/__tests__/officeReviewer.test.ts \
  server/modules/jobs/__tests__/officeReviewerStorage.test.ts \
  server/modules/jobs/__tests__/officeReviewerWrites.test.ts \
  server/modules/jobs/__tests__/officeReviewerFrontendState.test.ts \
  server/modules/work-orders/__tests__/workOrderBulkFinalDate.test.ts \
  server/modules/work-orders/__tests__/workOrderB2PatchValidation.test.ts \
  server/modules/work-orders/__tests__/severeCompletionImpact.test.ts \
  server/modules/sync/__tests__/jobTrackingGuard.test.ts \
  server/modules/sync/__tests__/officeReviewerSync.test.ts
