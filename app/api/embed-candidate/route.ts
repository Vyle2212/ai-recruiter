import { legacyIndexMutationResponse } from "@/lib/search/legacyIndexMutationGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The old route wrote candidates and index outside a shared transaction, and
// ignored write errors. Require reviewed promotion before enabling it again.
export async function POST() {
  return legacyIndexMutationResponse();
}
