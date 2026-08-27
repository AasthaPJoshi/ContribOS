import {
  createHash,
  randomBytes
} from "node:crypto";

const SESSION_TOKEN_BYTES = 32;
const SESSION_TOKEN_LENGTH = 43;

export interface SessionTokenPair {
  token: string;
  tokenHash: string;
}

export function hashSessionToken(
  token: string
): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

export function isPlausibleSessionToken(
  token: string
): boolean {
  return (
    token.length === SESSION_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(token)
  );
}

export function createSessionToken(): SessionTokenPair {
  const token = randomBytes(
    SESSION_TOKEN_BYTES
  ).toString("base64url");

  return {
    token,
    tokenHash: hashSessionToken(token)
  };
}
