import {
  isPlausibleSessionToken
} from "./session-token.js";

export const SESSION_COOKIE_NAME =
  "contribos_session";

export interface SessionCookieOptions {
  secure: boolean;
  maxAgeSeconds: number;
}

function cookieParts(
  cookieHeader: string
): string[] {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function readSessionToken(
  cookieHeader: string | undefined
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieParts(cookieHeader)) {
    const separatorIndex =
      part.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const name = part
      .slice(0, separatorIndex)
      .trim();

    if (name !== SESSION_COOKIE_NAME) {
      continue;
    }

    const token = part
      .slice(separatorIndex + 1)
      .trim();

    return isPlausibleSessionToken(token)
      ? token
      : null;
  }

  return null;
}

export function buildSessionCookie(
  token: string,
  options: SessionCookieOptions
): string {
  if (!isPlausibleSessionToken(token)) {
    throw new Error(
      "Invalid session token."
    );
  }

  if (
    !Number.isInteger(
      options.maxAgeSeconds
    ) ||
    options.maxAgeSeconds <= 0
  ) {
    throw new Error(
      "Session max age must be a positive integer."
    );
  }

  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`
  ];

  if (options.secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function buildSessionDeletionCookie(
  secure: boolean
): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
