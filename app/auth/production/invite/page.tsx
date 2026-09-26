import { notFound } from "next/navigation";
import { productionAuthConfigured } from "@/lib/productionAuthConfiguration";
import { ProductionInviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

export default function ProductionInvitePage() {
  if (!productionAuthConfigured()) notFound();
  return (
    <main className="min-h-screen bg-[#05070A] px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-[#0B0F16] p-6">
        <h1 className="text-2xl font-semibold">Set up admin access</h1>
        <div className="mt-6">
          <ProductionInviteForm />
        </div>
      </div>
    </main>
  );
}
