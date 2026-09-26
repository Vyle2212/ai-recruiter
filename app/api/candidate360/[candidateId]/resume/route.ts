import {
  recruiterSearchAuthorizationDenied,
  recruiterSearchPrivateNoStoreHeaders,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { originalCvReadGrant } from "@/lib/originalCvAccess";
import { ORIGINAL_CV_BUCKET } from "@/lib/originalCvArchiveKey";
import { originalCvStorageReadStatus } from "@/lib/originalCvStorageRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/candidate360/[candidateId]/resume",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
  if (authorization.scope.role !== "admin")
    return Response.json(
      { error: "original_cv_entitlement_required" },
      { status: 403, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  const { candidateId } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(candidateId))
    return Response.json(
      { error: "invalid_candidate_id" },
      { status: 400, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  const supabase = createLazySupabaseServiceClient();
  const candidate = await supabase
    .from("candidates")
    .select("source_file")
    .eq("id", candidateId)
    .maybeSingle();
  if (candidate.error)
    return Response.json(
      { error: "original_cv_lookup_unavailable" },
      { status: 503, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  const grant = originalCvReadGrant(
    authorization.scope.role,
    candidate.data?.source_file,
  );
  if (!grant)
    return Response.json(
      { error: "original_cv_not_found" },
      { status: 404, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  try {
    const downloaded = await supabase.storage
      .from(ORIGINAL_CV_BUCKET)
      .download(grant.objectKey);
    if (downloaded.error || !downloaded.data)
      return Response.json(
        {
          error:
            originalCvStorageReadStatus(downloaded.error) === 404
              ? "original_cv_not_found"
              : "original_cv_storage_unavailable",
        },
        {
          status: originalCvStorageReadStatus(downloaded.error),
          headers: recruiterSearchPrivateNoStoreHeaders,
        },
      );
    return new Response(downloaded.data, {
      headers: {
        ...recruiterSearchPrivateNoStoreHeaders,
        "Content-Type": grant.contentType,
        "Content-Disposition": grant.disposition,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "original_cv_storage_unavailable" },
      { status: 503, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  }
}
