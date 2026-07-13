import { NextResponse } from "next/server";
import { buildQuickFixWorkflowRefreshPreview } from "../../../../../lib/quickFixWorkflowRefreshPreview";
export async function GET(){return NextResponse.json(buildQuickFixWorkflowRefreshPreview());}
