import "server-only";

import { supabase } from "./supabase";

// These are the migration-owned fields and identity state needed before an
// original can be accepted. The checks return no candidate or review rows.
const candidateFields =
  "id,source_file,certifications,projects,extraction_coverage,extraction_coverage_status,profile_source_type,profile_confirmation_status,profile_source_state";

export async function adminCvUploadFoundationReady() {
  try {
    const [candidateSchema, reviewQueue] = await Promise.all([
      supabase.from("candidates").select(candidateFields).limit(0),
      supabase.from("candidate_upload_reviews").select("id").limit(0),
    ]);
    return !candidateSchema.error && !reviewQueue.error;
  } catch {
    return false;
  }
}
