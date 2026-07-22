import { NextResponse } from "next/server";import { buildRecruiterDashboard } from "@/lib/recruiterDashboard";export const runtime="nodejs";export const dynamic="force-dynamic";export async function GET(){return NextResponse.json(buildRecruiterDashboard());}

