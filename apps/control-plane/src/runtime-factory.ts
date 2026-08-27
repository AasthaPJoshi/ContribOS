import {
  createDatabaseHandle,
  WorkerJobRepository,
  type ContribOSDatabase
} from "@contribos/db";
import {
  GitHubApiClient,
  GitHubAppAuth,
  GitHubInstallationTokenProvider
} from "@contribos/github";
import { PostgresJobStore } from "@contribos/worker";

import { ApplicationRuntime } from "./application-runtime.js";
import { createJsonLogger } from "./logger.js";
import { DatabaseBackedPullRequestExecutor } from "./reconciliation-executor.js";
import { loadRuntimeConfig } from "./runtime-config.js";
import { DatabaseBackedSweepExecutor } from "./sweep-executor.js";

export interface RuntimeFactoryConfig {
  databaseUrl: string;
  githubAppId: string;
  githubPrivateKey: string;
}

export interface RuntimeHandle {
  runtime: ApplicationRuntime;
  db: ContribOSDatabase;
  close(): Promise<void>;
}

export function createRuntimeHandle(config: RuntimeFactoryConfig): RuntimeHandle {
  const database = createDatabaseHandle(config.databaseUrl);

  const auth = new GitHubAppAuth({
    appId: config.githubAppId,
    privateKey: config.githubPrivateKey
  });

  const tokenProvider = new GitHubInstallationTokenProvider({ auth });
  const github = new GitHubApiClient({ tokenProvider });

  const jobStore = new PostgresJobStore(
    new WorkerJobRepository(database.db)
  );

  const runtimeConfig = loadRuntimeConfig();

  const runtime = new ApplicationRuntime({
    store: jobStore,
    pullRequests: new DatabaseBackedPullRequestExecutor(database.db, github),
    sweeps: new DatabaseBackedSweepExecutor(database.db, jobStore),
    logger: createJsonLogger(),
    workerPollIntervalMs: runtimeConfig.workerPollIntervalMs
  });

  return {
    runtime,
    db: database.db,
    async close() {
      runtime.requestShutdown();
      tokenProvider.clear();
      await database.close();
    }
  };
}
