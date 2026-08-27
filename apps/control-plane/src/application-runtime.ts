import {
  WorkerLoop,
  WorkerRunner,
  type JobStore
} from "@contribos/worker";

import {
  ApplicationJobHandler,
  type PullRequestJobExecutor,
  type SweepJobExecutor
} from "./application-job-handler.js";
import {
  RuntimeHealth
} from "./health.js";
import type {
  RuntimeLogger
} from "./logger.js";
import {
  ReconciliationSweepProducer
} from "./sweep-producer.js";
import {
  WebhookApplicationService
} from "./webhook-application-service.js";

export interface ApplicationRuntimeOptions {
  store: JobStore;
  pullRequests:
    PullRequestJobExecutor;
  sweeps: SweepJobExecutor;
  logger: RuntimeLogger;
  workerPollIntervalMs?: number;
}

export class ApplicationRuntime {
  readonly health =
    new RuntimeHealth();

  readonly webhooks:
    WebhookApplicationService;

  readonly sweepProducer:
    ReconciliationSweepProducer;

  readonly runner:
    WorkerRunner;

  readonly loop:
    WorkerLoop;

  constructor(
    private readonly options:
      ApplicationRuntimeOptions
  ) {
    const handler =
      new ApplicationJobHandler(
        options.pullRequests,
        options.sweeps
      );

    this.webhooks =
      new WebhookApplicationService(
        options.store
      );

    this.sweepProducer =
      new ReconciliationSweepProducer(
        options.store
      );

    this.runner =
      new WorkerRunner(
        options.store,
        handler,
        {
          observer: {
            jobClaimed: (job) =>
              options.logger.info(
                "worker.job.claimed",
                {
                  jobId: job.id,
                  type: job.type
                }
              ),
            jobCompleted: (job) =>
              options.logger.info(
                "worker.job.completed",
                {
                  jobId: job.id,
                  type: job.type
                }
              ),
            jobRescheduled: (
              job,
              nextAttempt,
              availableAt
            ) =>
              options.logger.warn(
                "worker.job.rescheduled",
                {
                  jobId: job.id,
                  type: job.type,
                  nextAttempt,
                  availableAt:
                    availableAt
                      .toISOString()
                }
              ),
            jobDead: (
              job,
              errorCode
            ) =>
              options.logger.error(
                "worker.job.dead",
                {
                  jobId: job.id,
                  type: job.type,
                  errorCode
                }
              )
          }
        }
      );

    this.loop =
      new WorkerLoop(
        this.runner,
        {
          pollIntervalMs:
            options
              .workerPollIntervalMs ??
            1_000
        }
      );
  }

  markReady(): void {
    this.health.markReady();

    this.options.logger.info(
      "runtime.ready"
    );
  }

  requestShutdown(): void {
    this.health.beginShutdown();
    this.loop.requestStop();

    this.options.logger.info(
      "runtime.shutdown.requested"
    );
  }
}
