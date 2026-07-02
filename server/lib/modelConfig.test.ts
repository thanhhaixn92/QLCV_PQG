import { describe, expect, it } from "vitest";
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRO_MODEL,
  DEFAULT_TEXT_MODEL,
  getModelConfigStatus,
  normalizeModelName,
} from "./modelConfig";

describe("model config", () => {
  it("uses Gemini 2.5 defaults", () => {
    const status = getModelConfigStatus({});
    expect(status.models).toEqual({
      text: DEFAULT_TEXT_MODEL,
      pro: DEFAULT_PRO_MODEL,
      fallback: DEFAULT_FALLBACK_MODEL,
    });
    expect(status.modelConfigValid).toBe(true);
  });

  it("normalizes models/ prefixes", () => {
    expect(normalizeModelName("models/gemini-2.5-pro", DEFAULT_TEXT_MODEL)).toBe("gemini-2.5-pro");
  });

  it("reports invalid configured models", () => {
    const status = getModelConfigStatus({ GEMINI_TEXT_MODEL: "unknown-model" });
    expect(status.modelConfigValid).toBe(false);
    expect(status.modelConfigErrors[0]).toContain("unknown-model");
  });
});
