import { legacyIndexMutationResponse } from "@/lib/search/legacyIndexMutationGate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return legacyIndexMutationResponse();
}

export async function GET() {
  return legacyIndexMutationResponse();
}
