import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The legacy text-only API cannot archive or verify the original document.
// All CV processing must begin at the signed, private Storage upload flow.
export async function POST() {
  return NextResponse.json(
    { error: "Use the private CV upload page to process an original CV." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } },
  );
}
