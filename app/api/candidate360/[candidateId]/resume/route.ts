import { createCandidateSupabaseAdminClient } from "@/lib/candidateSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "candidate";
  return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "candidate";
}

export async function GET(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await context.params;
  const id = decodeURIComponent(candidateId).trim();
  const db = createCandidateSupabaseAdminClient();
  const { data, error } = await db.from("candidates").select("*").eq("id", id).maybeSingle();
  if (error) return new Response("Unable to load resume", { status: 500 });
  if (!data) return new Response("Candidate not found", { status: 404 });
  const resume = [data.resume_text, data.raw_text, data.raw_cv].find((value) => typeof value === "string" && value.trim());
  if (typeof resume !== "string") return new Response("Original resume is unavailable", { status: 404 });
  const inline = new URL(request.url).searchParams.get("mode") === "inline";
  const name = safeFilename(data.candidate_name || data.name || data.full_name);
  return new Response(resume, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}-resume.txt"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
