import { describe, expect, it } from "vitest";
import { buildHealthData, type HealthRouteState } from "./health";

const baseState: HealthRouteState = {
  firestoreReady: false,
  targetProjectId: "",
  configuredDatabaseId: "",
  credentialSource: "applicationDefault",
  credentialProjectId: "none",
  firestoreError: "not ready",
  firestoreErrorType: "db_not_initialized",
  firestoreRawCode: "5",
  canVerifyFirestore: false,
};

describe("health route payload", () => {
  it("keeps production health JSON safe and model-aware", () => {
    const data = buildHealthData(baseState, false, {
      NODE_ENV: "production",
    });

    expect(data).toMatchObject({
      ok: true,
      serverReady: true,
      firestoreReady: false,
      aiConfigured: false,
      models: {
        text: "gemini-2.5-flash-lite",
        pro: "gemini-2.5-pro",
        fallback: "gemini-2.5-flash-lite",
      },
      modelConfigValid: true,
    });
    expect(data.firestoreError).toBeUndefined();
  });

  it("includes debug Firestore details only when DEBUG_HEALTH is true", () => {
    const data = buildHealthData(baseState, true, {
      NODE_ENV: "production",
      DEBUG_HEALTH: "true",
      GEMINI_TEXT_MODEL: "bad-model",
    });

    expect(data).toMatchObject({
      hasSystemGeminiKey: true,
      firestoreError: "not ready",
      firestoreRawCode: "5",
      modelConfigValid: false,
    });
    expect(data.modelConfigErrors[0]).toContain("bad-model");
  });
});
