import "server-only";

import { supabase } from "./supabase";
import {
  ORIGINAL_CV_BUCKET,
  originalCvObjectKey,
} from "./originalCvArchiveKey";

export async function archiveOriginalCv(fileName: string, bytes: Buffer) {
  const { objectKey, contentType } = originalCvObjectKey(fileName, bytes);
  const { error } = await supabase.storage
    .from(ORIGINAL_CV_BUCKET)
    .upload(objectKey, bytes, {
      contentType,
      upsert: false,
    });
  if (error) throw new Error("CV_ORIGINAL_ARCHIVE_UNAVAILABLE");
  return { reference: `${ORIGINAL_CV_BUCKET}/${objectKey}`, objectKey };
}
