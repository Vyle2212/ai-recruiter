import { NextResponse } from "next/server"
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients"
import { recruiterSearchAuthorizationDenied, recruiterSearchPrivateNoStoreHeaders, requireRecruiterSearchAuthorization } from "@/lib/recruiterSearchAuthorization"

export async function POST(req: Request) {
  try {
    const authorization = await requireRecruiterSearchAuthorization({ permission: "candidate-detail:read", route: "/api/update-candidate-status" })
    if (!authorization.allowed) return recruiterSearchAuthorizationDenied(authorization)
    const supabase = createLazySupabaseServiceClient()
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
          headers: recruiterSearchPrivateNoStoreHeaders,
        }
      )
    }

    return NextResponse.json(data, { headers: recruiterSearchPrivateNoStoreHeaders })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
        headers: recruiterSearchPrivateNoStoreHeaders,
      }
    )
  }
}
