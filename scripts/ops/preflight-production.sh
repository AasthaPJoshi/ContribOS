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

node <<'NODE'
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const appId = Number(process.env.GITHUB_APP_ID);
if (!Number.isSafeInteger(appId) || appId <= 0) {
  fail("GITHUB_APP_ID must be a positive integer.");
}

let publicUrl;
try {
  publicUrl = new URL(process.env.CONTRIBOS_PUBLIC_BASE_URL);
} catch {
  fail("CONTRIBOS_PUBLIC_BASE_URL must be a valid URL.");
}

if (publicUrl.protocol !== "https:") {
  fail("CONTRIBOS_PUBLIC_BASE_URL must use https in production.");
}

if (publicUrl.username || publicUrl.password) {
  fail("CONTRIBOS_PUBLIC_BASE_URL must not contain credentials.");
}

const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl.startsWith("postgresql://") &&
  !databaseUrl.startsWith("postgres://")
) {
  fail("DATABASE_URL must be a PostgreSQL connection string.");
}

const decoded = Buffer.from(
  process.env.CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY,
  "base64"
);
if (decoded.length !== 32) {
  fail("CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes.");
}

if (!process.env.GITHUB_PRIVATE_KEY.includes("PRIVATE KEY")) {
  fail("GITHUB_PRIVATE_KEY does not look like a PEM private key.");
}

if (process.env.GITHUB_WEBHOOK_SECRET.length < 16) {
  fail("GITHUB_WEBHOOK_SECRET is too short for production.");
}

console.log("Production configuration preflight passed.");
NODE
