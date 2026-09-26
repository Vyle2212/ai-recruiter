import { productionAuthConfigured } from "@/lib/productionAuthConfiguration";
import LegacyHome from "./LegacyHome";
import { ProductionAuthEntry } from "./auth/production/ProductionAuthEntry";

export const dynamic = "force-dynamic";

export default function Home() {
  if (productionAuthConfigured()) return <ProductionAuthEntry />;
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.PRODUCTION_AUTH_ENABLED === "true"
  )
    return (
      <main className="min-h-screen bg-[#05070A] px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-[#0B0F16] p-6">
          <h1 className="text-2xl font-semibold">AI Recruiter Admin</h1>
          <p className="mt-6">
            Admin access is temporarily unavailable while data protection is
            being verified.
          </p>
        </div>
      </main>
    );
  return <LegacyHome />;
}
