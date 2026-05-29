function safeKeyPart(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return fallback;
}

export function getStableEntityId(
  item: { id?: unknown; clientId?: unknown; createdAt?: unknown; title?: unknown; name?: unknown },
  fallbackPrefix: string,
  index: number
): string {
  const id = safeKeyPart(item.id, "");
  if (id) return id;

  const clientId = safeKeyPart(item.clientId, "");
  if (clientId) return clientId;

  const createdAt = safeKeyPart(item.createdAt, "");
  const title = safeKeyPart(item.title, "");
  const name = safeKeyPart(item.name, "");
  const label = title || name || "untitled";

  return `${fallbackPrefix}-missing-${createdAt || "no-date"}-${index}-${label.slice(0, 24)}`;
}

export function getRenderKey(
  scope: string,
  item: { id?: unknown; clientId?: unknown; createdAt?: unknown; title?: unknown; name?: unknown } | null | undefined,
  index: number
): string {
  const safeScope = safeKeyPart(scope, "scope");
  if (!item) return `${safeScope}-missing-item-${index}`;

  const stableId = getStableEntityId(item, safeScope, index);
  return `${safeScope}-${stableId}`;
}

/**
 * Helper for static lists (tabs, filters, status codes)
 */
export function staticKey(scope: string, code: unknown, index: number): string {
  const safeScope = typeof scope === "string" && scope.trim() ? scope.trim() : "static";
  const safeCode =
    typeof code === "string" && code.trim()
      ? code.trim()
      : typeof code === "number"
        ? String(code)
        : `missing-${index}`;

  return `${safeScope}-${safeCode}`;
}

export function dedupeByStableId<
  T extends { id?: unknown; clientId?: unknown; createdAt?: unknown; title?: unknown; name?: unknown }
>(items: T[], scope: string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  items.forEach((item, index) => {
    const id = getStableEntityId(item, scope, index);

    if (seen.has(id)) {
      console.warn(`[${scope}] duplicate item ignored`, {
        id,
        index,
        item,
      });
      return;
    }

    seen.add(id);
    output.push(item);
  });

  return output;
}

/**
 * Debug helper to find duplicate OR empty keys before rendering.
 * Only runs in development mode.
 */
export function debugKeys(scope: string, keys: string[]) {
  if (typeof window === "undefined" || !import.meta.env.DEV) return;

  const emptyKeys = keys.filter((k) => !k || !String(k).trim());
  const seen = new Set<string>();
  const duplicateKeys: string[] = [];

  keys.forEach((k) => {
    if (seen.has(k)) duplicateKeys.push(k);
    seen.add(k);
  });

  if (emptyKeys.length || duplicateKeys.length) {
    console.warn(`[KEY_DEBUG:${scope}]`, {
      emptyKeys,
      duplicateKeys,
      keys,
    });
  }
}

/**
 * Deprecated: use debugKeys
 */
export function debugDuplicateKeys(scope: string, keys: any[]) {
  debugKeys(scope, keys.map(String));
}
