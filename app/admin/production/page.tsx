import { notFound, redirect } from "next/navigation";
import { productionAuthConfigured } from "@/lib/productionAuthConfiguration";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductionAdminPage() {
  if (!productionAuthConfigured()) notFound();
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult.user) redirect("/auth/login");
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("auth_user_id,email,role,status")
    .eq("auth_user_id", userResult.user.id)
    .maybeSingle();
  if (
    !profile ||
    profile.auth_user_id !== userResult.user.id ||
    profile.role !== "admin" ||
    profile.status !== "active"
  )
    notFound();

  return (
    <main className="min-h-screen bg-[#05070A] px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold">AI Recruiter Admin</h1>
        <p className="mt-3">Signed in as {profile.email}</p>
        <p className="mt-2 text-slate-400">
          Your production admin identity is active. Candidate data tools will
          appear after the data access cutover is verified.
        </p>
      </div>
    </main>
  );
}
