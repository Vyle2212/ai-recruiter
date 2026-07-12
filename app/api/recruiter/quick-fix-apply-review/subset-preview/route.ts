import { NextResponse } from "next/server";
import { buildQuickFixApplySubsetPreview } from "../../../../../lib/quickFixApplySubsetBuilder";
export async function GET() { return NextResponse.json(buildQuickFixApplySubsetPreview()); }
export async function POST(request: Request) { const body = await request.json().catch(() => ({})); return NextResponse.json(buildQuickFixApplySubsetPreview({ decisionsPath: body.decisionsPath })); }
