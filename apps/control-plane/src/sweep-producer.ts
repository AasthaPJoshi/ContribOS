import {
  enqueueReconciliationSweep,
  type JobStore,
  type ReconciliationSweepJobPayload
} from "@contribos/worker";

export class ReconciliationSweepProducer {
  constructor(
    private readonly store: JobStore
  ) {}

  async enqueue(
    payload:
      ReconciliationSweepJobPayload,
    now = new Date()
  ): Promise<boolean> {
    return enqueueReconciliationSweep(
      this.store,
      payload,
      { now }
    );
  }
}
