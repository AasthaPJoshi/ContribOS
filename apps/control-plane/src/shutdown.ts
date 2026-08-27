export interface ShutdownTarget {
  requestShutdown(): void;
}

export interface ShutdownRegistration {
  unregister(): void;
}

export function registerProcessShutdown(
  target: ShutdownTarget,
  processLike: Pick<
    NodeJS.Process,
    "on" | "off"
  > = process
): ShutdownRegistration {
  const handler = () => {
    target.requestShutdown();
  };

  processLike.on(
    "SIGTERM",
    handler
  );

  processLike.on(
    "SIGINT",
    handler
  );

  return {
    unregister() {
      processLike.off(
        "SIGTERM",
        handler
      );

      processLike.off(
        "SIGINT",
        handler
      );
    }
  };
}
