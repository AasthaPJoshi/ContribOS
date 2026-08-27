import {
  describe,
  expect,
  it
} from "vitest";

import {
  attentionReasonLabel,
  priorityClass,
  summarizeAttention
} from "../src/product/attention-view-model.js";

describe(
  "attention queue view model",
  () => {
    it("summarizes visible queue priorities", () => {
      const summary =
        summarizeAttention({
          items: [
            {
              priorityBand:
                "CRITICAL"
            },
            {
              priorityBand: "HIGH"
            },
            {
              priorityBand: "HIGH"
            }
          ] as never[],
          page: 1,
          pageSize: 25,
          total: 9,
          totalPages: 1
        });

      expect(summary).toEqual({
        total: 9,
        critical: 1,
        high: 2,
        normal: 0,
        low: 0
      });
    });

    it("humanizes priority reason codes", () => {
      expect(
        attentionReasonLabel([
          "AMBIGUOUS_STATE",
          "READY_TO_MERGE"
        ])
      ).toBe(
        "Ambiguous State, Ready To Merge"
      );
    });

    it("returns a stable priority CSS class", () => {
      expect(
        priorityClass({
          priorityBand: "CRITICAL"
        })
      ).toBe("priority-critical");
    });
  }
);
