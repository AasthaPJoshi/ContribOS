import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";

import type {
  GitHubWebhookService
} from "./github-webhook-service.js";
import type {
  RuntimeHealth
} from "./health.js";
import type {
  RuntimeLogger
} from "./logger.js";
import {
  handleProductHttpRequest,
  type ProductQueryApi
} from "./product-http-api.js";
import type {
  AuthService
} from "./security/auth-service.js";
import {
  readOAuthStateCookie
} from "./security/oauth-state-cookie.js";
import type {
  RepositoryAuthorizationService
} from "./security/repository-authorization-service.js";
import {
  securityHeaders
} from "./security/security-headers.js";
import {
  readSessionToken
} from "./security/session-cookie.js";

const MAX_BODY_BYTES =
  2 * 1024 * 1024;

export type AuthApi = Pick<
  AuthService,
  | "beginLogin"
  | "completeLogin"
  | "resolveSessionContext"
  | "signOut"
>;

export type RepositoryAuthorizationApi =
  Pick<
    RepositoryAuthorizationService,
    "authorize"
  >;

function applySecurityHeaders(
  response: ServerResponse
): void {
  for (
    const [name, value] of
    Object.entries(
      securityHeaders()
    )
  ) {
    response.setHeader(
      name,
      value
    );
  }
}

function json(
  response: ServerResponse,
  statusCode: number,
  value: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader(
    "content-type",
    "application/json; charset=utf-8"
  );
  response.end(
    JSON.stringify(value)
  );
}

function empty(
  response: ServerResponse,
  statusCode: number
): void {
  response.statusCode =
    statusCode;
  response.end();
}

function redirect(
  response: ServerResponse,
  location: string,
  cookies: string[] = []
): void {
  response.statusCode = 302;
  response.setHeader(
    "location",
    location
  );

  if (cookies.length > 0) {
    response.setHeader(
      "set-cookie",
      cookies
    );
  }

  response.end();
}

async function readRawBody(
  request: IncomingMessage
): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (
    const chunk of request
  ) {
    const buffer =
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);

    total += buffer.length;

    if (
      total >
      MAX_BODY_BYTES
    ) {
      throw new Error(
        "REQUEST_BODY_TOO_LARGE"
      );
    }

    chunks.push(buffer);
  }

  return Buffer
    .concat(chunks)
    .toString("utf8");
}

function header(
  request: IncomingMessage,
  name: string
): string | undefined {
  const value =
    request.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function requestUrl(
  request: IncomingMessage,
  publicOrigin: string
): URL {
  return new URL(
    request.url ?? "/",
    publicOrigin
  );
}

function repositoryIdFromPath(
  pathname: string
): number | null {
  const match =
    /^\/api\/repositories\/([1-9]\d*)(?:\/|$)/.exec(
      pathname
    );

  if (!match?.[1]) {
    return null;
  }

  const parsed =
    Number(match[1]);

  return Number.isSafeInteger(
    parsed
  )
    ? parsed
    : null;
}

function isJsonContentType(
  request: IncomingMessage
): boolean {
  const value =
    header(
      request,
      "content-type"
    );

  if (!value) {
    return false;
  }

  return value
    .toLowerCase()
    .split(";", 1)[0]
    ?.trim() ===
    "application/json";
}

function sameOrigin(
  request: IncomingMessage,
  publicOrigin: string
): boolean {
  const origin =
    header(request, "origin");

  if (!origin) {
    return false;
  }

  try {
    return (
      new URL(origin).origin ===
      new URL(publicOrigin).origin
    );
  } catch {
    return false;
  }
}

export interface HttpServerOptions {
  health: RuntimeHealth;
  webhook: GitHubWebhookService;
  logger: RuntimeLogger;
  productQueries:
    ProductQueryApi;
  auth: AuthApi;
  repositoryAuthorization:
    RepositoryAuthorizationApi;
  publicOrigin: string;
}

export function createControlPlaneServer(
  options: HttpServerOptions
): Server {
  return createServer(
    async (
      request,
      response
    ) => {
      applySecurityHeaders(
        response
      );

      try {
        const url =
          requestUrl(
            request,
            options.publicOrigin
          );

        if (
          request.method === "GET" &&
          url.pathname === "/live"
        ) {
          json(
            response,
            200,
            options.health.snapshot()
          );
          return;
        }

        if (
          request.method === "GET" &&
          url.pathname === "/ready"
        ) {
          const snapshot =
            options.health
              .snapshot();

          json(
            response,
            snapshot.ready
              ? 200
              : 503,
            snapshot
          );
          return;
        }

        if (
          request.method === "GET" &&
          url.pathname ===
            "/auth/github/login"
        ) {
          const result =
            await options.auth
              .beginLogin();

          redirect(
            response,
            result.authorizationUrl,
            [result.stateCookie]
          );
          return;
        }

        if (
          request.method === "GET" &&
          url.pathname ===
            "/auth/github/callback"
        ) {
          const code =
            url.searchParams
              .get("code");
          const callbackState =
            url.searchParams
              .get("state");
          const cookieState =
            readOAuthStateCookie(
              header(
                request,
                "cookie"
              )
            );

          if (
            !code ||
            !callbackState ||
            !cookieState
          ) {
            json(
              response,
              400,
              {
                status: "ERROR",
                reasonCode:
                  "OAUTH_CALLBACK_INVALID"
              }
            );
            return;
          }

          try {
            const result =
              await options.auth
                .completeLogin({
                  code,
                  callbackState,
                  cookieState
                });

            redirect(
              response,
              "/",
              [
                result.sessionCookie,
                result.clearStateCookie
              ]
            );
            return;
          } catch (error) {
            const reason =
              error instanceof Error
                ? error.message
                : "";

            if (
              reason ===
                "OAUTH_STATE_MISMATCH" ||
              reason ===
                "OAUTH_STATE_INVALID_OR_EXPIRED"
            ) {
              json(
                response,
                400,
                {
                  status: "ERROR",
                  reasonCode:
                    reason
                }
              );
              return;
            }

            throw error;
          }
        }

        if (
          request.method ===
            "POST" &&
          url.pathname ===
            "/auth/logout"
        ) {
          if (
            !sameOrigin(
              request,
              options.publicOrigin
            )
          ) {
            json(
              response,
              403,
              {
                status: "ERROR",
                reasonCode:
                  "ORIGIN_NOT_ALLOWED"
              }
            );
            return;
          }

          const rawToken =
            readSessionToken(
              header(
                request,
                "cookie"
              )
            );

          if (rawToken) {
            const deletionCookie =
              await options.auth
                .signOut(
                  rawToken
                );

            response.setHeader(
              "set-cookie",
              deletionCookie
            );
          }

          empty(
            response,
            204
          );
          return;
        }

        if (
          request.method === "GET" &&
          url.pathname
            .startsWith("/api/")
        ) {
          const rawToken =
            readSessionToken(
              header(
                request,
                "cookie"
              )
            );

          if (!rawToken) {
            json(
              response,
              401,
              {
                status: "ERROR",
                reasonCode:
                  "UNAUTHENTICATED"
              }
            );
            return;
          }

          const authContext =
            await options.auth
              .resolveSessionContext(
                rawToken
              );

          if (!authContext) {
            json(
              response,
              401,
              {
                status: "ERROR",
                reasonCode:
                  "UNAUTHENTICATED"
              }
            );
            return;
          }

          if (
            url.pathname ===
              "/api/auth/me"
          ) {
            json(
              response,
              200,
              {
                user:
                  authContext
                    .principal
              }
            );
            return;
          }

          const repositoryId =
            repositoryIdFromPath(
              url.pathname
            );

          if (
            repositoryId !== null
          ) {
            const authorization =
              await options
                .repositoryAuthorization
                .authorize(
                  {
                    principal:
                      authContext
                        .principal,
                    githubAccessTokenCiphertext:
                      authContext
                        .githubAccessTokenCiphertext,
                    githubAccessTokenExpiresAt:
                      authContext
                        .githubAccessTokenExpiresAt
                  },
                  repositoryId,
                  "READ"
                );

            if (
              !authorization.allowed
            ) {
              const reauth =
                authorization.reason ===
                "REAUTHENTICATION_REQUIRED";

              const hiddenRepository =
                authorization.reason ===
                "REPOSITORY_NOT_AUTHORIZED";

              json(
                response,
                reauth
                  ? 401
                  : hiddenRepository
                    ? 404
                    : 403,
                hiddenRepository
                  ? {
                      status:
                        "NOT_FOUND"
                    }
                  : {
                      status: "ERROR",
                      reasonCode:
                        authorization
                          .reason
                    }
              );
              return;
            }
          }

          const result =
            await handleProductHttpRequest(
              request,
              options.productQueries
            );

          if (result.handled) {
            json(
              response,
              result.statusCode,
              result.body
            );
            return;
          }
        }

        if (
          request.method ===
            "POST" &&
          url.pathname ===
            "/webhooks/github"
        ) {
          if (
            !isJsonContentType(
              request
            )
          ) {
            json(
              response,
              415,
              {
                status: "ERROR",
                reasonCode:
                  "UNSUPPORTED_MEDIA_TYPE"
              }
            );
            return;
          }

          const rawBody =
            await readRawBody(
              request
            );

          const result =
            await options.webhook
              .handle({
                rawBody,
                deliveryId:
                  header(
                    request,
                    "x-github-delivery"
                  ),
                eventName:
                  header(
                    request,
                    "x-github-event"
                  ),
                signature:
                  header(
                    request,
                    "x-hub-signature-256"
                  )
              });

          json(
            response,
            result.statusCode,
            result.body
          );
          return;
        }

        json(
          response,
          404,
          {
            status:
              "NOT_FOUND"
          }
        );
      } catch (error) {
        options.logger.error(
          "http.request.failed",
          {
            message:
              error instanceof Error
                ? error.message
                : "Unknown failure."
          }
        );

        const tooLarge =
          error instanceof Error &&
          error.message ===
            "REQUEST_BODY_TOO_LARGE";

        json(
          response,
          tooLarge
            ? 413
            : 500,
          {
            status: "ERROR",
            reasonCode:
              tooLarge
                ? "REQUEST_BODY_TOO_LARGE"
                : "INTERNAL_ERROR"
          }
        );
      }
    }
  );
}
