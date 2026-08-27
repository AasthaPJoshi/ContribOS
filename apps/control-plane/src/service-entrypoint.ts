import {
  WebhookDeliveryRepository
} from "@contribos/db";

import {
  GitHubWebhookService
} from "./github-webhook-service.js";
import {
  createControlPlaneServer
} from "./http-server.js";
import {
  createJsonLogger
} from "./logger.js";
import {
  createRuntimeHandle
} from "./runtime-factory.js";
import {
  loadServiceConfig
} from "./service-config.js";
import {
  ProductQueryService
} from "./product-query-service.js";
import {
  SweepScheduler
} from "./sweep-scheduler.js";

const config = loadServiceConfig();
const logger = createJsonLogger();

const handle = createRuntimeHandle({
  databaseUrl: config.databaseUrl,
  githubAppId: config.githubAppId,
  githubPrivateKey: config.githubPrivateKey
});

const deliveries =
  new WebhookDeliveryRepository(handle.db);

const webhook = new GitHubWebhookService(
  config.githubWebhookSecret,
  deliveries,
  handle.runtime.webhooks
);

const productQueries =
  new ProductQueryService(handle.db);

const scheduler = new SweepScheduler(
  handle.db,
  handle.runtime.sweepProducer,
  logger,
  {
    intervalMs:
      config.reconciliationSweepIntervalMs
  }
);

const server = createControlPlaneServer({
  health: handle.runtime.health,
  webhook,
  logger,
  productQueries
});

let shuttingDown = false;

async function shutdown(
  signal: string
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info(
    "service.shutdown",
    { signal }
  );

  handle.runtime.requestShutdown();
  scheduler.stop();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await handle.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal)
      .then(() => {
        process.exitCode = 0;
      })
      .catch((error) => {
        logger.error(
          "service.shutdown.failed",
          {
            message:
              error instanceof Error
                ? error.message
                : "Unknown failure."
          }
        );
        process.exitCode = 1;
      });
  });
}

server.listen(
  config.port,
  config.host,
  () => {
    handle.runtime.markReady();
    scheduler.start();

    logger.info(
      "service.started",
      {
        host: config.host,
        port: config.port
      }
    );

    void handle.runtime.loop.run().catch((error) => {
      logger.error(
        "worker.loop.failed",
        {
          message:
            error instanceof Error
              ? error.message
              : "Unknown failure."
        }
      );

      void shutdown("WORKER_LOOP_FAILURE");
    });
  }
);
