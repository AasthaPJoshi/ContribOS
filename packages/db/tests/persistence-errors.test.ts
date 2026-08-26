import {
  describe,
  expect,
  it
} from "vitest";

import {
  classifyPersistenceError
} from "../src/persistence-errors.js";

describe("classifyPersistenceError", () => {
  it("classifies unique violations as non-retryable conflicts", () => {
    expect(
      classifyPersistenceError({
        code: "23505"
      })
    ).toMatchObject({
      code: "CONFLICT",
      retryable: false
    });
  });

  it("classifies serialization failures as retryable", () => {
    expect(
      classifyPersistenceError({
        code: "40001"
      })
    ).toMatchObject({
      code: "TRANSIENT_DATABASE_ERROR",
      retryable: true
    });
  });
});
