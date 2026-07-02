import { describe, expect, it } from "vitest";
import {
  ensureUniquePreviewTasks,
  extractJsonFromText,
  normalizeAIResponseToArray,
} from "./taskAiUtils";

describe("task AI utilities", () => {
  it("extracts JSON from fenced AI text", () => {
    const parsed = extractJsonFromText('Kết quả:\n```json\n{"tasks":[{"title":"Kiểm tra"}]}\n```');
    expect(parsed).toEqual({ tasks: [{ title: "Kiểm tra" }] });
  });

  it("normalizes supported list containers", () => {
    expect(normalizeAIResponseToArray({ taskDrafts: [{ title: "A" }] })).toEqual([{ title: "A" }]);
  });

  it("normalizes task defaults and drops invalid items", () => {
    const tasks = ensureUniquePreviewTasks([
      { title: "  Hoàn thiện báo cáo  ", priority: "invalid", categoryCode: "BAD" },
      { description: "missing title" },
    ]);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: "Hoàn thiện báo cáo",
      priority: "medium",
      categoryCode: "LV_DH",
      status: "todo",
      selected: true,
    });
  });
});
