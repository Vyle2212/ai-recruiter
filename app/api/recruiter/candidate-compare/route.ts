import { NextResponse } from "next/server";
import { runCandidateCompare } from "@/lib/candidateCompareData";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){try{return NextResponse.json(await runCandidateCompare(await request.json()));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to compare candidates"},{status:400});}}

