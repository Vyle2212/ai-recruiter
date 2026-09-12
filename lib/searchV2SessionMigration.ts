import { normalizeSearchV2Response, type NormalizedSearchV2Response } from "./searchV2ResponseContract";

export type SearchV2StoredSnapshot = Record<string, unknown>;
export type SearchV2SessionLoadResult =
  | { status: "missing" }
  | { status: "evicted" }
  | { status: "restored"; snapshot: SearchV2StoredSnapshot; response: NormalizedSearchV2Response | null };

type SearchV2SessionStorage = Pick<Storage, "getItem" | "removeItem">;

export function loadSearchV2SessionSnapshot(storage: SearchV2SessionStorage, key: string): SearchV2SessionLoadResult {
  const raw = storage.getItem(key);
  if (!raw) return { status: "missing" };

  let snapshot: unknown;
  try {
    snapshot = JSON.parse(raw);
  } catch {
    storage.removeItem(key);
    return { status: "evicted" };
  }

  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    storage.removeItem(key);
    return { status: "evicted" };
  }

  const storedSnapshot = snapshot as SearchV2StoredSnapshot;
  if (!storedSnapshot.response) return { status: "restored", snapshot: storedSnapshot, response: null };
  const normalized = normalizeSearchV2Response(storedSnapshot.response);
  if (!normalized.ok) {
    storage.removeItem(key);
    return { status: "evicted" };
  }
  return { status: "restored", snapshot: storedSnapshot, response: normalized.response };
}