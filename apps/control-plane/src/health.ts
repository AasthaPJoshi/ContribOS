export interface HealthSnapshot {
  live: boolean;
  ready: boolean;
  shuttingDown: boolean;
}

export class RuntimeHealth {
  private ready = false;
  private shuttingDown = false;

  markReady(): void {
    if (!this.shuttingDown) {
      this.ready = true;
    }
  }

  beginShutdown(): void {
    this.shuttingDown = true;
    this.ready = false;
  }

  snapshot(): HealthSnapshot {
    return {
      live: true,
      ready: this.ready,
      shuttingDown:
        this.shuttingDown
    };
  }
}
