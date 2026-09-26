import { legacyIndexMutationResponse } from "@/lib/search/legacyIndexMutationGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return legacyIndexMutationResponse();
}
