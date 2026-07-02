export const DEFAULT_TEXT_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_PRO_MODEL = "gemini-2.5-pro";
export const DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash-lite";

export const ALLOWED_MODELS = [
  DEFAULT_TEXT_MODEL,
  "gemini-2.5-flash",
  DEFAULT_PRO_MODEL,
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
] as const;

export interface ModelConfigStatus {
  models: {
    text: string;
    pro: string;
    fallback: string;
  };
  modelConfigValid: boolean;
  modelConfigErrors: string[];
}

export function normalizeModelName(
  name: string | undefined,
  defaultModel: string,
): string {
  let target = (name || defaultModel).trim().toLowerCase();

  if (target.startsWith("models/")) {
    target = target.replace(/^models\//, "");
  }

  return target;
}

export function validateModelWithWhitelist(modelName: string): void {
  const allowCustom = process.env.ALLOW_CUSTOM_MODELS === "true";
  const cleanModel = normalizeModelName(modelName, "");
  if (!allowCustom && cleanModel && !ALLOWED_MODELS.includes(cleanModel as any)) {
    throw new Error(
      `Model ${cleanModel} không được hỗ trợ. Vui lòng chọn model trong danh sách (hoặc cấu hình ALLOW_CUSTOM_MODELS=true).`,
    );
  }
}

export function getModelConfigStatus(env: NodeJS.ProcessEnv): ModelConfigStatus {
  const models = {
    text: normalizeModelName(env.GEMINI_TEXT_MODEL, DEFAULT_TEXT_MODEL),
    pro: normalizeModelName(env.GEMINI_PRO_MODEL, DEFAULT_PRO_MODEL),
    fallback: normalizeModelName(env.GEMINI_FALLBACK_MODEL, DEFAULT_FALLBACK_MODEL),
  };

  const modelConfigErrors: string[] = [];

  for (const [key, model] of Object.entries(models)) {
    try {
      validateModelWithWhitelist(model);
    } catch (error: any) {
      modelConfigErrors.push(`${key}: ${error.message}`);
    }
  }

  return {
    models,
    modelConfigValid: modelConfigErrors.length === 0,
    modelConfigErrors,
  };
}
