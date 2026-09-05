#!/usr/bin/env bash
set -euo pipefail

required=(
  DATABASE_URL
  GITHUB_APP_ID
  GITHUB_PRIVATE_KEY
  GITHUB_WEBHOOK_SECRET
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  CONTRIBOS_PUBLIC_BASE_URL
  CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY
)

missing=()

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing required production environment variables:\n' >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

case "$CONTRIBOS_PUBLIC_BASE_URL" in
  https://*)
    ;;
  *)
    echo "CONTRIBOS_PUBLIC_BASE_URL must use https in production." >&2
    exit 1
    ;;
esac

if [[ "${CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY}" == "change-me" ]]; then
  echo "Refusing placeholder credential encryption key." >&2
  exit 1
fi

echo "Production configuration preflight passed."
