import type express from "express";
import { getModelConfigStatus } from "../lib/modelConfig";

export interface HealthRouteState {
  firestoreReady: boolean;
  targetProjectId: string;
  configuredDatabaseId: string;
  credentialSource: string;
  credentialProjectId: string;
  firestoreError: string | null;
  firestoreErrorType: string | null;
  firestoreRawCode: string | null;
  canVerifyFirestore: boolean;
}

export interface HealthRouteDeps {
  getState: () => HealthRouteState;
  verifyFirestoreAccess: () => Promise<void>;
  getSystemGeminiApiKey: () => string;
  env?: NodeJS.ProcessEnv;
}

export function buildHealthData(
  state: HealthRouteState,
  hasSystemGeminiKey: boolean,
  env: NodeJS.ProcessEnv = process.env,
) {
  const modelConfig = getModelConfigStatus(env);
  const isDebug = env.DEBUG_HEALTH === "true";
  const isProduction = env.NODE_ENV === "production";

  let healthData: any = {
    ok: true,
    serverReady: true,
    firestoreReady: state.firestoreReady,
    firebaseProjectId: state.targetProjectId || "",
    firestoreDatabaseId: state.configuredDatabaseId || "",
    firestoreDatabaseIdLength: state.configuredDatabaseId
      ? state.configuredDatabaseId.length
      : 0,
    aiConfigured: hasSystemGeminiKey,
    models: modelConfig.models,
    modelConfigValid: modelConfig.modelConfigValid,
    modelConfigErrors: modelConfig.modelConfigErrors,
    driveConfigured: !!env.GOOGLE_DRIVE_API_KEY,
    timestamp: new Date().toISOString(),
  };

  if (!isProduction || isDebug) {
    healthData = {
      ...healthData,
      firebaseConfigured: !!state.targetProjectId,
      errorType: state.firestoreErrorType,
      credentialSource: state.credentialSource,
      credentialProjectId: state.credentialProjectId,
      hasSystemGeminiKey,
      hasGoogleDriveKey: !!env.GOOGLE_DRIVE_API_KEY,
      hasEncryptionSecret: !!env.AI_KEY_ENCRYPTION_SECRET,
    };

    if (isDebug) {
      healthData.firestoreError = state.firestoreError;
      healthData.firestoreErrorType = state.firestoreErrorType;
      healthData.firestoreRawCode = state.firestoreRawCode;
    }
  }

  return healthData;
}

export function registerHealthRoute(
  app: express.Application,
  deps: HealthRouteDeps,
) {
  app.get("/api/health", async (_req, res) => {
    const env = deps.env || process.env;
    if (env.DEBUG_HEALTH === "true") console.log("[HEALTH] request");

    let state = deps.getState();
    if (!state.firestoreReady && state.canVerifyFirestore) {
      await deps.verifyFirestoreAccess();
      state = deps.getState();
    }

    const sysKey = deps.getSystemGeminiApiKey();
    const healthData = buildHealthData(state, !!sysKey, env);

    if (env.DEBUG_HEALTH === "true") console.log("[HEALTH] response");
    res.json(healthData);
  });
}
