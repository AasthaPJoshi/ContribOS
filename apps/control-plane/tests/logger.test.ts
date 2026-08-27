import {
  describe,
  expect,
  it
} from "vitest";

import {
  createJsonLogger
} from "../src/logger.js";

describe("createJsonLogger", () => {
  it("emits structured JSON records", () => {
    const lines: string[] = [];

    const logger =
      createJsonLogger(
        (line) =>
          lines.push(line)
      );

    logger.info(
      "runtime.test",
      { value: 42 }
    );

    expect(lines).toHaveLength(1);

    const record =
      JSON.parse(
        lines[0]!
      ) as {
        level: string;
        event: string;
        fields: {
          value: number;
        };
      };

    expect(record.level).toBe(
      "info"
    );

    expect(record.event).toBe(
      "runtime.test"
    );

    expect(
      record.fields.value
    ).toBe(42);
  });
});
