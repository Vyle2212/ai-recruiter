import { NextResponse } from "next/server";
import { loadSmartShortlistBoard } from "@/lib/smartShortlistData";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { try { return NextResponse.json(await loadSmartShortlistBoard()); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Smart Shortlist" }, { status: 500 }); } }

