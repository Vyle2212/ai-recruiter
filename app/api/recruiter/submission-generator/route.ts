import { NextResponse } from "next/server";import { runSubmissionGeneration } from "@/lib/submissionGeneratorData";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){try{return NextResponse.json(await runSubmissionGeneration(await request.json()));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to generate submission draft"},{status:400});}}
