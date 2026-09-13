import {
  checkDatabaseReady,
  AuthSessionRepository,
  AuthUserRepository,
  OAuthStateRepository,
  InstallationRepository,
  RepositoryRepository,
  RepositoryAccessScopeRepository,
  WebhookDeliveryRepository,
  runDatabaseMigrations
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
  ProductQueryService
} from "./product-query-service.js";
import {
  createRuntimeHandle
} from "./runtime-factory.js";
import {
  loadAuthConfig
} from "./security/auth-config.js";
import {
  AuthService
} from "./security/auth-service.js";
import {
  GitHubOAuthClient
} from "./security/github-oauth-client.js";
import {
  GitHubUserAccessClient
} from "./security/github-user-access-client.js";
import {
  GitHubInstallationSyncService
} from "./security/github-installation-sync-service.js";
import {
  RepositoryAuthorizationService
} from "./security/repository-authorization-service.js";
import {
  loadServiceConfig
} from "./service-config.js";
import {
  SweepScheduler
} from "./sweep-scheduler.js";

const config =
  loadServiceConfig();
const authConfig =
  loadAuthConfig();
const logger =
  createJsonLogger();

const handle =
  createRuntimeHandle({
    databaseUrl:
      config.databaseUrl,
    githubAppId:
      config.githubAppId,
    githubPrivateKey:
      config.githubPrivateKey
  });

const deliveries =
  new WebhookDeliveryRepository(
    handle.db
  );

const webhook =
  new GitHubWebhookService(
    config.githubWebhookSecret,
    deliveries,
    handle.runtime.webhooks
  );

const productQueries =
  new ProductQueryService(
    handle.db
  );

const installationSync =
  new GitHubInstallationSyncService({
    installations:
      new InstallationRepository(
        handle.db
      ),
    repositories:
      new RepositoryRepository(
        handle.db
      ),
    github:
      new GitHubUserAccessClient(),
    credentialEncryptionKey:
      authConfig
        .credentialEncryptionKey
  });

const auth =
  new AuthService({
    oauth:
      new GitHubOAuthClient({
        clientId:
          authConfig
            .githubOAuthClientId,
        clientSecret:
          authConfig
            .githubOAuthClientSecret,
        callbackUrl:
          authConfig.callbackUrl
      }),
    users:
      new AuthUserRepository(
        handle.db
      ),
    sessions:
      new AuthSessionRepository(
        handle.db
      ),
    oauthStates:
      new OAuthStateRepository(
        handle.db
      ),
    installationSync,
    credentialEncryptionKey:
      authConfig
        .credentialEncryptionKey,
    secureCookies:
      authConfig.secureCookies,
    sessionTtlSeconds:
      authConfig
        .sessionTtlSeconds,
    oauthStateTtlSeconds:
      authConfig
        .oauthStateTtlSeconds
  });

const repositoryAuthorization =
  new RepositoryAuthorizationService(
    {
      scopes:
        new RepositoryAccessScopeRepository(
          handle.db
        ),
      github:
        new GitHubUserAccessClient(),
      credentialEncryptionKey:
        authConfig
          .credentialEncryptionKey
    }
  );

const scheduler =
  new SweepScheduler(
    handle.db,
    handle.runtime
      .sweepProducer,
    logger,
    {
      intervalMs:
        config
          .reconciliationSweepIntervalMs
    }
  );

const server =
  createControlPlaneServer({
    health:
      handle.runtime.health,
    readinessChecks: {
      database: () =>
        checkDatabaseReady(handle.db)
    },
    webhook,
    logger,
    productQueries,
    auth,
    repositoryAuthorization,
    publicOrigin:
      new URL(
        authConfig.publicBaseUrl
      ).origin
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

  handle.runtime
    .requestShutdown();
  scheduler.stop();

  await new Promise<void>(
    (resolve) => {
      server.close(
        () => resolve()
      );
    }
  );

  await scheduler.stopAndWait();
  await handle.close();
}

for (
  const signal of
  ["SIGINT", "SIGTERM"] as const
) {
  process.on(
    signal,
    () => {
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
    }
  );
}

async function start(): Promise<void> {
  await runDatabaseMigrations(
    handle.db
  );

  server.listen(
    config.port,
    config.host,
    () => {
      handle.runtime
        .markReady();
      scheduler.start();

      logger.info(
        "service.started",
        {
          host:
            config.host,
          port:
            config.port
        }
      );

      void handle.runtime
        .startWorker()
        .catch((error) => {
          logger.error(
            "worker.loop.failed",
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown failure."
            }
          );

          void shutdown(
            "WORKER_LOOP_FAILURE"
          );
        });
    }
  );
}

void start().catch(async (error) => {
  logger.error(
    "service.startup.failed",
    {
      message:
        error instanceof Error
          ? error.message
          : "Unknown failure."
    }
  );

  try {
    await handle.close();
  } finally {
    process.exitCode = 1;
  }
});
