import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildSupabaseServerCookieAdapter } from '../../lib/supabaseServerCookieAdapter'

export async function createClient() {
  const cookieStore = await cookies()
  const adapter = buildSupabaseServerCookieAdapter({
    getAll: () => cookieStore.getAll(),
    set: (name, value, options) => cookieStore.set(name, value, options),
  })

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: adapter.getAll,
        setAll(cookiesToSet) {
          try { adapter.setAll(cookiesToSet) }
          catch {
            // Server Components cannot write cookies. Auth mutations execute
            // through Server Actions, where the write is supported.
          }
        },
      },
    },
  )
}