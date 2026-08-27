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

const MAX_BODY_BYTES = 2 * 1024 * 1024;

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
  response.end(JSON.stringify(value));
}

async function readRawBody(
  request: IncomingMessage
): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);

    total += buffer.length;

    if (total > MAX_BODY_BYTES) {
      throw new Error("REQUEST_BODY_TOO_LARGE");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function header(
  request: IncomingMessage,
  name: string
): string | undefined {
  const value = request.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export interface HttpServerOptions {
  health: RuntimeHealth;
  webhook: GitHubWebhookService;
  logger: RuntimeLogger;
}

export function createControlPlaneServer(
  options: HttpServerOptions
): Server {
  return createServer(
    async (request, response) => {
      try {
        if (
          request.method === "GET" &&
          request.url === "/live"
        ) {
          json(response, 200, options.health.snapshot());
          return;
        }

        if (
          request.method === "GET" &&
          request.url === "/ready"
        ) {
          const snapshot = options.health.snapshot();
          json(response, snapshot.ready ? 200 : 503, snapshot);
          return;
        }

        if (
          request.method === "POST" &&
          request.url === "/webhooks/github"
        ) {
          const rawBody = await readRawBody(request);
          const result = await options.webhook.handle({
            rawBody,
            deliveryId: header(request, "x-github-delivery"),
            eventName: header(request, "x-github-event"),
            signature: header(request, "x-hub-signature-256")
          });

          json(response, result.statusCode, result.body);
          return;
        }

        json(response, 404, { status: "NOT_FOUND" });
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
          error.message === "REQUEST_BODY_TOO_LARGE";

        json(
          response,
          tooLarge ? 413 : 500,
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
