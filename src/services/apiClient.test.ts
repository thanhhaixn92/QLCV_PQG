import { describe, expect, it } from "vitest";
import { shouldRetryApiError } from "./apiClient";

describe("api retry policy", () => {
  it("retries transient backend and network errors", () => {
    expect(shouldRetryApiError({ status: 503 })).toBe(true);
    expect(shouldRetryApiError({ status: 500 })).toBe(true);
    expect(shouldRetryApiError({})).toBe(true);
  });

  it("does not retry terminal client or AI capacity errors", () => {
    expect(shouldRetryApiError({ status: 401 })).toBe(false);
    expect(shouldRetryApiError({ status: 404 })).toBe(false);
    expect(shouldRetryApiError({ status: 503, errorType: "ai_overloaded" })).toBe(false);
    expect(shouldRetryApiError({ status: 429, errorType: "quota_exceeded" })).toBe(false);
  });
});
