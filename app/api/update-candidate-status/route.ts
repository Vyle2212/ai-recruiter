import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { candidate_id, status } = body

    const { data, error } = await supabase
      .from("candidates")
      .update({
        status,
      })
      .eq("id", candidate_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    )
  }
}