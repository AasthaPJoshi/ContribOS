import type { WorkerRunner } from "./worker-runner.js";

export interface WorkerLoopOptions {
  pollIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class WorkerLoop {
  private stopping = false;
  private readonly pollIntervalMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    private readonly runner: WorkerRunner,
    options: WorkerLoopOptions = {}
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.sleep =
      options.sleep ??
      (async (milliseconds) => {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, milliseconds)
        );
      });
  }

  requestStop(): void {
    this.stopping = true;
  }

  async run(): Promise<void> {
    while (!this.stopping) {
      const result = await this.runner.runOnce();

      if (result.status === "IDLE") {
        await this.sleep(this.pollIntervalMs);
      }
    }
  }
}
