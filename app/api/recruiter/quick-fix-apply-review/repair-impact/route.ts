import { NextResponse } from "next/server";
import { buildQuickFixRepairImpactReport } from "../../../../../lib/quickFixRepairImpactReport";
export async function GET(){return NextResponse.json(buildQuickFixRepairImpactReport());}
