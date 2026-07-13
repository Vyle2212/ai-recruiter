import { NextResponse } from "next/server";
import { buildQuickFixPostApplyVerification } from "../../../../../lib/quickFixPostApplyVerification";
export async function GET(){return NextResponse.json(buildQuickFixPostApplyVerification());}
