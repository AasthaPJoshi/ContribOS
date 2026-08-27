import { describe, expect, it } from "vitest";

import {
  InMemoryConcurrencyGuard,
  repositoryConcurrencyKey
} from "../src/concurrency-guard.js";

describe("InMemoryConcurrencyGuard", () => {
  it("prevents simultaneous work for the same repository", async () => {
    const guard = new InMemoryConcurrencyGuard();
    const key = repositoryConcurrencyKey(1, 2);

    expect(await guard.tryAcquire(key)).toBe(true);
    expect(await guard.tryAcquire(key)).toBe(false);

    await guard.release(key);

    expect(await guard.tryAcquire(key)).toBe(true);
  });
});
