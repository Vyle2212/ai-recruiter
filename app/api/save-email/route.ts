import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      candidate_id,
      subject,
      content,
    } = body

    const { data, error } =
      await supabase
        .from("emails")
        .insert([
          {
            candidate_id,
            subject,
            content,
          },
        ])
        .select()

    if (error) {
      throw error
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.log(error)

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