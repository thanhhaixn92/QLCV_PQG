const sanitizeKeyPart = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
};

const fallbackKey = (prefix: string, index?: number): string => {
  const safePrefix = sanitizeKeyPart(prefix) || "render-key";
  const safeIndex = Number.isFinite(index) ? index : 0;
  return `${safePrefix}-fallback-${safeIndex}`;
};

export const staticKey = (prefix: string, value: unknown, index?: number): string => {
  const safePrefix = sanitizeKeyPart(prefix) || "static-key";
  const safeValue = sanitizeKeyPart(value);
  return safeValue ? `${safePrefix}-${safeValue}` : fallbackKey(safePrefix, index);
};

export const getRenderKey = (
  prefix: string,
  item: { id?: unknown; clientId?: unknown } | null | undefined,
  index?: number,
): string => {
  const safePrefix = sanitizeKeyPart(prefix) || "render-key";
  const clientId = sanitizeKeyPart(item?.clientId);
  if (clientId) return `${safePrefix}-client-${clientId}`;

  const id = sanitizeKeyPart(item?.id);
  if (id) return `${safePrefix}-id-${id}`;

  return fallbackKey(safePrefix, index);
};
