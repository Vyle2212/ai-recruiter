const message =
  "Legacy search-index writes are disabled until an approved exact-set transaction and readback are available.";

export function legacyIndexMutationRefusal(): never {
  throw new Error(message);
}

export function legacyIndexMutationResponse() {
  return Response.json(
    { success: false, error: "search_index_promotion_required" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
