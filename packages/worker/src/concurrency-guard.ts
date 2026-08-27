export class InMemoryConcurrencyGuard {
  private readonly active = new Set<string>();

  async tryAcquire(key: string): Promise<boolean> {
    if (this.active.has(key)) {
      return false;
    }

    this.active.add(key);
    return true;
  }

  async release(key: string): Promise<void> {
    this.active.delete(key);
  }
}

export function repositoryConcurrencyKey(
  installationId: number,
  repositoryId: number
): string {
  return ["repo", installationId, repositoryId].join(":");
}
