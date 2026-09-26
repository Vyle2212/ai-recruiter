import { NextRequest, NextResponse } from "next/server";
import { requireRecruiterApiRouteAuthorization } from "@/lib/recruiterApiAuthorization";
import { supabase } from "@/lib/supabase";
import {
  MAX_ORIGINAL_BYTES,
  ORIGINAL_CV_BUCKET,
  originalCvObjectKey,
} from "@/lib/originalCvArchiveKey";
import { normalizeCvContentDigest } from "@/lib/serverCvContentDigest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const authorization = await requireRecruiterApiRouteAuthorization({
    request,
  });
  if (!authorization.allowed) return authorization.response;

  let input: {
    fileName?: unknown;
    size?: unknown;
    contentDigest?: unknown;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid upload request." },
      { status: 400, headers: privateHeaders },
    );
  }
  const fileName = typeof input.fileName === "string" ? input.fileName : "";
  const size = input.size;
  if (
    !normalizeCvContentDigest(input.contentDigest) ||
    !Number.isSafeInteger(size) ||
    Number(size) < 1 ||
    Number(size) > MAX_ORIGINAL_BYTES
  ) {
    return NextResponse.json(
      { error: `CV must be between 1 byte and ${MAX_ORIGINAL_BYTES} bytes.` },
      { status: 400, headers: privateHeaders },
    );
  }

  let object: ReturnType<typeof originalCvObjectKey>;
  try {
    // Validate extension before signing; actual bytes are checked after upload.
    object = originalCvObjectKey(fileName, Buffer.alloc(1));
  } catch {
    return NextResponse.json(
      { error: "Only PDF, DOCX, DOC, RTF, and TXT CVs are supported." },
      { status: 400, headers: privateHeaders },
    );
  }

  const objectKey = `${authorization.scope.subjectId}/${object.objectKey}`;
  const { data, error } = await supabase.storage
    .from(ORIGINAL_CV_BUCKET)
    .createSignedUploadUrl(objectKey);
  if (error || !data?.token) {
    return NextResponse.json(
      { error: "Private CV storage is unavailable." },
      { status: 503, headers: privateHeaders },
    );
  }
  return NextResponse.json(
    { objectKey, token: data.token, contentType: object.contentType },
    { headers: privateHeaders },
  );
}
