import { NextResponse } from "next/server";
import { buildQuickFixRollbackReadiness } from "../../../../../lib/quickFixRollbackReadiness";
export async function GET(){return NextResponse.json(buildQuickFixRollbackReadiness());}
