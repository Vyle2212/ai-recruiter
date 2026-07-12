import { NextResponse } from "next/server";
import fs from "node:fs";
export async function GET(){const exists=fs.existsSync("reports/quick-fix-apply-subset.json");return NextResponse.json({mode:"read-only subset audit; no candidate DB writes",subsetFileExists:exists});}
