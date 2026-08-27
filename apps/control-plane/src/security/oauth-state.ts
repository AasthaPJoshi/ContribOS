import {
  createHash,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const OAUTH_STATE_BYTES = 32;
const OAUTH_STATE_LENGTH = 43;

export function createOAuthState():
  string {
  return randomBytes(
    OAUTH_STATE_BYTES
  ).toString("base64url");
}

export function isPlausibleOAuthState(
  value: string
): boolean {
  return (
    value.length ===
      OAUTH_STATE_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function hashOAuthState(
  value: string
): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

export function oauthStatesMatch(
  left: string,
  right: string
): boolean {
  if (
    !isPlausibleOAuthState(left) ||
    !isPlausibleOAuthState(right)
  ) {
    return false;
  }

  const leftBuffer =
    Buffer.from(left, "utf8");
  const rightBuffer =
    Buffer.from(right, "utf8");

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}
