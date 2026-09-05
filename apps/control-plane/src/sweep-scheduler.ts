import {
  InstallationRepository,
  type ContribOSDatabase,
  type InstallationRow
} from "@contribos/db";

import type {
  RuntimeLogger
} from "./logger.js";
import type {
  ReconciliationSweepProducer
} from "./sweep-producer.js";

export interface InstallationListStore {
  listAll(): Promise<InstallationRow[]>;
}

export interface SweepSchedulerOptions {
  intervalMs: number;
  installations?: InstallationListStore;
}

export class SweepScheduler {
  private timer: NodeJS.Timeout | null = null;
  private activeRun: Promise<number> | null = null;
  private readonly installations:
    InstallationListStore;

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
      options.installations ??
      new InstallationRepository(db);
  }

  private async executeOnce(): Promise<number> {
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

  runOnce(): Promise<number> {
    if (this.activeRun) {
      this.logger.warn(
        "sweep.skipped_overlap"
      );
      return Promise.resolve(0);
    }

    const run = this.executeOnce();
    this.activeRun = run;

    const clearActiveRun = () => {
      if (this.activeRun === run) {
        this.activeRun = null;
      }
    };

    void run.then(
      clearActiveRun,
      clearActiveRun
    );

    return run;
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

  async stopAndWait(): Promise<void> {
    this.stop();

    const activeRun = this.activeRun;

    if (activeRun) {
      await activeRun;
    }
  }
}
