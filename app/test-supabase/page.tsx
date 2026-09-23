import { getSAPModules } from "@/src/services/knowledge";

import { normalizeSAPSkill } from "@/src/utils/sapNormalizer";

interface SAPModule {
  id: string;
  module: string;
  category: string;
}

export const dynamic = "force-dynamic";

export default async function TestSupabasePage() {
  const modules = (await getSAPModules()) as SAPModule[];

  return (
    <div className="min-h-screen bg-black p-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <h1 className="text-5xl font-bold">SAP Knowledge Layer</h1>

          <p className="mt-4 text-zinc-400">Supabase semantic registry test</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <div
              key={module.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-600"
            >
              <div className="text-3xl font-bold">
                {normalizeSAPSkill(module.module)}
              </div>

              <div className="mt-2 text-zinc-400">{module.category}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
