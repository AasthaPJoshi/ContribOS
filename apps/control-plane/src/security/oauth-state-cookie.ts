import {
  isPlausibleOAuthState
} from "./oauth-state.js";

export const OAUTH_STATE_COOKIE_NAME =
  "contribos_oauth_state";

export interface OAuthStateCookieOptions {
  secure: boolean;
  maxAgeSeconds: number;
}

export function readOAuthStateCookie(
  cookieHeader: string | undefined
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (
    const rawPart of
    cookieHeader.split(";")
  ) {
    const part = rawPart.trim();
    const separator =
      part.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const name = part
      .slice(0, separator)
      .trim();

    if (
      name !==
      OAUTH_STATE_COOKIE_NAME
    ) {
      continue;
    }

    const value = part
      .slice(separator + 1)
      .trim();

    return isPlausibleOAuthState(
      value
    )
      ? value
      : null;
  }

  return null;
}

export function buildOAuthStateCookie(
  state: string,
  options: OAuthStateCookieOptions
): string {
  if (
    !isPlausibleOAuthState(state)
  ) {
    throw new Error(
      "Invalid OAuth state."
    );
  }

  const attributes = [
    `${OAUTH_STATE_COOKIE_NAME}=${state}`,
    "Path=/auth/github",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`
  ];

  if (options.secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function buildOAuthStateDeletionCookie(
  secure: boolean
): string {
  const attributes = [
    `${OAUTH_STATE_COOKIE_NAME}=`,
    "Path=/auth/github",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
