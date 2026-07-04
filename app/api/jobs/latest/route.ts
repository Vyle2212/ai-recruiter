import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return NextResponse.json({
        error: error.message,
      })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.log(err)

    return NextResponse.json({
      error: 'Internal server error',
    })
  }
}