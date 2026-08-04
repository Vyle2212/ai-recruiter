import { NextResponse } from "next/server";
import { buildQuickFixApplyReviewBoard } from "../../../../../lib/quickFixApplyReviewBoard";
export async function GET() { return NextResponse.json(buildQuickFixApplyReviewBoard()); }
