#!/usr/bin/env bash
set -euo pipefail

CONTAINER="contribos-postgres"
DB_USER="contribos"
DB_NAME="contribos"

INSTALLATION_ID=157117377
REPOSITORY_ID=1360689962

echo "============================================"
echo " ContribOS Recruiter Demo Bootstrap"
echo "============================================"
echo
echo "Installation: ${INSTALLATION_ID}"
echo "Repository:   ${REPOSITORY_ID}"
echo "PRs:          1 2 3 4 5"
echo

echo "Checking demo repository registration..."

REPO_COUNT="$(
  docker exec "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" \
    -tAc "
      SELECT COUNT(*)
      FROM repositories
      WHERE github_repository_id = '${REPOSITORY_ID}'
        AND is_active = true;
    "
)"

if [ "$REPO_COUNT" != "1" ]; then
  echo "ERROR: contribos-demo is not registered in ContribOS."
  exit 1
fi

echo "Repository registration OK."
echo

RUN_ID="$(date +%s)"

for PR in 1 2 3 4 5; do
  echo "Enqueueing PR #${PR}..."

  docker exec "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -c "
      INSERT INTO worker_jobs (
        id,
        type,
        payload,
        deduplication_key,
        status,
        attempt,
        max_attempts,
        available_at
      )
      VALUES (
        gen_random_uuid(),
        'RECONCILE_PULL_REQUEST',
        jsonb_build_object(
          'installationId', ${INSTALLATION_ID},
          'repositoryId', ${REPOSITORY_ID},
          'pullRequestNumber', ${PR}
        ),
        'recruiter-demo:${RUN_ID}:${REPOSITORY_ID}:${PR}',
        'QUEUED',
        0,
        5,
        now()
      );
    " >/dev/null

done

echo
echo "All reconciliation jobs queued."
echo
echo "Waiting for ContribOS worker..."
echo

for ATTEMPT in $(seq 1 30); do
  ACTIVE="$(
    docker exec "$CONTAINER" \
      psql -U "$DB_USER" -d "$DB_NAME" \
      -tAc "
        SELECT COUNT(*)
        FROM worker_jobs
        WHERE deduplication_key LIKE 'recruiter-demo:${RUN_ID}:%'
          AND status IN ('QUEUED', 'CLAIMED');
      "
  )"

  if [ "$ACTIVE" = "0" ]; then
    break
  fi

  printf "."
  sleep 2
done

echo
echo
echo "Job results:"
echo

docker exec "$CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" \
  -P pager=off \
  -c "
    SELECT
      payload->>'pullRequestNumber' AS pr,
      status,
      attempt,
      last_error_code,
      left(coalesce(last_error_message, ''), 70) AS error
    FROM worker_jobs
    WHERE deduplication_key LIKE 'recruiter-demo:${RUN_ID}:%'
    ORDER BY (payload->>'pullRequestNumber')::int;
  "

echo
echo "============================================"
echo " Bootstrap complete"
echo "============================================"
echo
echo "Refresh the ContribOS dashboard."
