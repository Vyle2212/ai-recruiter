import { NextResponse } from "next/server";
import { loadQuickFixApplyDecisions, writeQuickFixApplyDecisions } from "../../../../../lib/quickFixApplyDecisionStore";
export async function GET() { return NextResponse.json(loadQuickFixApplyDecisions()); }
export async function POST(request: Request) { const body = await request.json().catch(() => ({})); return NextResponse.json(writeQuickFixApplyDecisions({ writeDecisionFile: Boolean(body.writeDecisionFile), decisionMode: body.decisionMode || "suggested" })); }
