import {
  InstallationRepository,
  type ContribOSDatabase
} from "@contribos/db";

import type {
  RuntimeLogger
} from "./logger.js";
import type {
  ReconciliationSweepProducer
} from "./sweep-producer.js";

export interface SweepSchedulerOptions {
  intervalMs: number;
}

export class SweepScheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly installations:
    InstallationRepository;

  constructor(
    db: ContribOSDatabase,
    private readonly producer:
      ReconciliationSweepProducer,
    private readonly logger:
      RuntimeLogger,
    private readonly options:
      SweepSchedulerOptions
  ) {
    this.installations =
      new InstallationRepository(db);
  }

  async runOnce(): Promise<number> {
    const installations =
      await this.installations.listAll();

    let enqueued = 0;

    for (const installation of installations) {
      const githubId = Number(
        installation.githubInstallationId
      );

      if (
        !Number.isSafeInteger(githubId) ||
        githubId <= 0
      ) {
        this.logger.warn(
          "sweep.installation.invalid",
          { installationId: installation.id }
        );
        continue;
      }

      if (
        await this.producer.enqueue({
          installationId: githubId
        })
      ) {
        enqueued += 1;
      }
    }

    this.logger.info(
      "sweep.completed",
      { enqueued }
    );

    return enqueued;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(
      () => {
        void this.runOnce().catch((error) => {
          this.logger.error(
            "sweep.failed",
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown failure."
            }
          );
        });
      },
      this.options.intervalMs
    );
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }
}
