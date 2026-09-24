import { NextRequest, NextResponse } from "next/server";

import {
  authorizeCandidateCvUpload,
  candidateCvUploadRuntimeEnabled,
  validateCandidateCvWriteRequest,
} from "@/lib/candidateCvAuthorization";
import {
  MAX_ORIGINAL_BYTES,
  ORIGINAL_CV_BUCKET,
  originalCvObjectKey,
} from "@/lib/originalCvArchiveKey";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization, Origin",
};

export async function POST(request: NextRequest) {
  if (!candidateCvUploadRuntimeEnabled())
    return NextResponse.json(
      { error: "Candidate CV upload is not enabled." },
      { status: 503, headers: privateHeaders },
    );

  const rejectedWrite = validateCandidateCvWriteRequest(request);
  if (rejectedWrite)
    return NextResponse.json(
      { error: rejectedWrite.code },
      { status: rejectedWrite.status, headers: privateHeaders },
    );

  const authorization = await authorizeCandidateCvUpload();
  if (!authorization.allowed)
    return NextResponse.json(
      { error: authorization.code },
      { status: authorization.status, headers: privateHeaders },
    );

  let input: { fileName?: unknown; size?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid upload request." },
      { status: 400, headers: privateHeaders },
    );
  }

  const fileName = typeof input.fileName === "string" ? input.fileName : "";
  if (
    !Number.isSafeInteger(input.size) ||
    Number(input.size) < 1 ||
    Number(input.size) > MAX_ORIGINAL_BYTES
  ) {
    return NextResponse.json(
      { error: `CV must be between 1 byte and ${MAX_ORIGINAL_BYTES} bytes.` },
      { status: 400, headers: privateHeaders },
    );
  }

  let object: ReturnType<typeof originalCvObjectKey>;
  try {
    object = originalCvObjectKey(fileName, Buffer.alloc(1));
  } catch {
    return NextResponse.json(
      { error: "Only PDF, DOCX, and TXT CVs are supported." },
      { status: 400, headers: privateHeaders },
    );
  }

  const objectKey = `${authorization.scope.authUserId}/${object.objectKey}`;
  const { data, error } = await supabase.storage
    .from(ORIGINAL_CV_BUCKET)
    .createSignedUploadUrl(objectKey);
  if (error || !data?.token)
    return NextResponse.json(
      { error: "Private CV storage is unavailable." },
      { status: 503, headers: privateHeaders },
    );

  return NextResponse.json(
    {
      objectKey,
      token: data.token,
      contentType: object.contentType,
      maxBytes: MAX_ORIGINAL_BYTES,
    },
    { headers: privateHeaders },
  );
}
