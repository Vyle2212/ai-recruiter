import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  console.log("FETCHING CANDIDATES...");

  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("SUPABASE DATA:", data);
  console.log("SUPABASE ERROR:", error);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data || []);
}