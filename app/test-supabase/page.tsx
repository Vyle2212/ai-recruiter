'use client'

import { useEffect, useState } from 'react'

import { getSAPModules } from '@/src/services/knowledge'

import { normalizeSAPSkill } from '@/src/utils/sapNormalizer'

interface SAPModule {
  id: string
  module: string
  category: string
}

export default function TestSupabasePage() {
  const [modules, setModules] = useState<
    SAPModule[]
  >([])

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {
    async function loadModules() {
      try {
        const data = await getSAPModules()

        setModules(data || [])
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadModules()
  }, [])

  return (
    <div className="min-h-screen bg-black p-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <h1 className="text-5xl font-bold">
            SAP Knowledge Layer
          </h1>

          <p className="mt-4 text-zinc-400">
            Supabase semantic registry test
          </p>
        </div>

        {loading ? (
          <div className="text-zinc-400">
            Loading SAP modules...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <div
                key={module.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-600"
              >
                <div className="text-3xl font-bold">
                  {normalizeSAPSkill(
                    module.module,
                  )}
                </div>

                <div className="mt-2 text-zinc-400">
                  {module.category}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}