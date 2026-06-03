function extractFriendlyField(record: Record<string, unknown>): string | null {
  for (const key of ["reply", "message", "content", "text"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function formatStructuredValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const lines = value
      .map((item) => formatStructuredValue(item))
      .filter((item): item is string => Boolean(item));
    return lines.length > 0 ? lines.slice(0, 5).map((line) => `• ${line}`).join("\n") : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const friendly = extractFriendlyField(record);
    if (friendly) return friendly;

    const entries = Object.entries(record)
      .filter(([, entryValue]) => typeof entryValue === "string" || typeof entryValue === "number" || typeof entryValue === "boolean")
      .slice(0, 5)
      .map(([key, entryValue]) => `${key}: ${String(entryValue)}`);
    return entries.length > 0 ? entries.join("\n") : null;
  }
  return null;
}

export function sanitizeAssistantMessageText(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const maybeJson = (text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"));
  if (!maybeJson) return text;

  try {
    const parsed = JSON.parse(text) as unknown;
    return formatStructuredValue(parsed) || "Tôi đã nhận được dữ liệu có cấu trúc, nhưng chưa có nội dung trả lời phù hợp để hiển thị.";
  } catch {
    return text;
  }
}
