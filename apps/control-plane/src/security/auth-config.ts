export interface AuthConfig {
  githubOAuthClientId: string;
  githubOAuthClientSecret: string;
  publicBaseUrl: string;
  callbackUrl: string;
  credentialEncryptionKey: string;
  secureCookies: boolean;
  sessionTtlSeconds: number;
  oauthStateTtlSeconds: number;
}

function required(
  env: NodeJS.ProcessEnv,
  name: string
): string {
  const value = env[name];

  if (!value?.trim()) {
    throw new Error(
      `${name} is required.`
    );
  }

  return value.trim();
}

function firstRequired(
  env: NodeJS.ProcessEnv,
  primary: string,
  legacy: string
): string {
  const primaryValue =
    env[primary]?.trim();

  if (primaryValue) {
    return primaryValue;
  }

  const legacyValue =
    env[legacy]?.trim();

  if (legacyValue) {
    return legacyValue;
  }

  throw new Error(
    `${primary} is required.`
  );
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    throw new Error(
      `${name} must be a positive integer.`
    );
  }

  return parsed;
}

function validatedBaseUrl(
  raw: string
): URL {
  const url = new URL(raw);

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw new Error(
      "CONTRIBOS_PUBLIC_BASE_URL must use http or https."
    );
  }

  const localHost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";

  if (
    url.protocol !== "https:" &&
    !localHost
  ) {
    throw new Error(
      "CONTRIBOS_PUBLIC_BASE_URL must use https outside local development."
    );
  }

  return url;
}

export function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env
): AuthConfig {
  const baseUrl = validatedBaseUrl(
    required(
      env,
      "CONTRIBOS_PUBLIC_BASE_URL"
    )
  );

  return {
    githubOAuthClientId:
      firstRequired(
        env,
        "GITHUB_CLIENT_ID",
        "GITHUB_OAUTH_CLIENT_ID"
      ),
    githubOAuthClientSecret:
      firstRequired(
        env,
        "GITHUB_CLIENT_SECRET",
        "GITHUB_OAUTH_CLIENT_SECRET"
      ),
    publicBaseUrl:
      baseUrl.toString(),
    callbackUrl:
      new URL(
        "/auth/github/callback",
        baseUrl
      ).toString(),
    credentialEncryptionKey:
      required(
        env,
        "CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY"
      ),
    secureCookies:
      baseUrl.protocol === "https:",
    sessionTtlSeconds:
      positiveInteger(
        env[
          "CONTRIBOS_SESSION_TTL_SECONDS"
        ],
        604_800,
        "CONTRIBOS_SESSION_TTL_SECONDS"
      ),
    oauthStateTtlSeconds:
      positiveInteger(
        env[
          "CONTRIBOS_OAUTH_STATE_TTL_SECONDS"
        ],
        600,
        "CONTRIBOS_OAUTH_STATE_TTL_SECONDS"
      )
  };
}
