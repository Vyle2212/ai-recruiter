import Module from "node:module";

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
const suspiciousRules = {
  appendedLabel:
    /\b(?:age|experience|company|employer|role|position)\s*[:.-]?\s*$/i,
  appendedMonthOrDate:
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|(?:19|20)\d{2})\s*$/i,
  organization:
    /\b(?:minerals?|sdn\.?\s*bhd|pte\.?\s*ltd|limited|corporation|company|consulting|technolog(?:y|ies)|solutions?|services?)\b/i,
  narrativeOrHeading:
    /\b(?:professional summary|profile summary|curriculum vitae|working experience|career objective|personal details|responsibilities)\b/i,
  sentence: /[.!?]$|\b(?:is|has|with|covering|responsible for)\b/i,
};

function flags(value: unknown) {
  const name = normalize(value);
  return Object.entries(suspiciousRules)
    .filter(([, pattern]) => pattern.test(name))
    .map(([key]) => key);
}

function safeContext(source: unknown, needle: string) {
  const text = String(source || "")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email redacted]")
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, "[phone redacted]");
  const offset = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (offset < 0) return "";
  return text
    .slice(
      Math.max(0, offset - 100),
      Math.min(text.length, offset + needle.length + 180),
    )
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };
  const [
    { createCandidateSupabaseAdminClient },
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    { normalizeActualCandidateSchema },
    { canonicalTalentSearchIdentity },
  ] = await Promise.all([
    import("../lib/candidateSupabase"),
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/candidate360SchemaNormalize"),
    import("../lib/talentSearchDisplay"),
  ]);
  const dataset = await fetchCandidateSource();
  const dedupe = dedupeCandidateSearchV2Documents(dataset.documents);
  const targetTokens = new Set([
    "#B975E8",
    "#FD1174",
    "#A8CCB8",
    "#9E1593",
    "#625FE9",
    "#CDBEB6",
    "#A30872",
    "#6071FA",
    "#0E69E4",
    "#5B5F13",
    "#288918",
    "#37AC6D",
    "#E27BD6",
  ]);
  const selected = dedupe.documents.filter((item) =>
    targetTokens.has(
      canonicalTalentSearchIdentity(item.candidateId).identityToken,
    ),
  );
  const traceIds = selected.flatMap((item) =>
    item.sourceCandidateIds?.length
      ? item.sourceCandidateIds
      : [item.candidateId],
  );
  const mergeIds = dedupe.documents
    .filter(
      (item) => new Set(item.sourceCandidateIds || [item.candidateId]).size > 1,
    )
    .flatMap((item) => item.sourceCandidateIds || [item.candidateId]);
  const ids = [...new Set([...traceIds, ...mergeIds])];
  const supabase = createCandidateSupabaseAdminClient();
  const [
    { data: rawRows, error: rawError },
    { data: indexRows, error: indexError },
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select(
        "id,name,title,current_title,headline,summary,raw_text,resume_text",
      )
      .in("id", ids),
    supabase
      .from("candidate_search_index")
      .select("candidate_id,display_name,display_title,display_company")
      .in("candidate_id", ids),
  ]);
  if (rawError) throw new Error(rawError.message);
  if (indexError) throw new Error(indexError.message);
  const rawById = new Map(
    (rawRows || []).map((row) => [
      String(row.id),
      row as Record<string, unknown>,
    ]),
  );
  const indexById = new Map(
    (indexRows || []).map((row) => [
      String(row.candidate_id),
      row as Record<string, unknown>,
    ]),
  );
  const traces = selected.map((document) => {
    const sourceId = document.sourceCandidateIds?.[0] || document.candidateId;
    const raw = rawById.get(sourceId) || {};
    const normalizedProfile = normalizeActualCandidateSchema({
      ...raw,
      id: sourceId,
    });
    const rawName = normalize(raw.name);
    return {
      token: canonicalTalentSearchIdentity(document.candidateId).identityToken,
      sourceId,
      rawNameField: rawName || null,
      rawNamePath: rawName ? "candidates.name" : null,
      rawNameFlags: flags(rawName),
      rawContext: rawName
        ? safeContext(raw.raw_text || raw.resume_text, rawName)
        : "",
      rawTitle: normalize(raw.title || raw.current_title) || null,
      rawHeadline: normalize(raw.headline) || null,
      normalizedName: normalizedProfile.enterpriseProfile.identity.name || null,
      searchIndexDisplayName:
        normalize(indexById.get(sourceId)?.display_name) || null,
      searchProjectionName: document.candidateName || null,
      detailIdentityName:
        normalizedProfile.enterpriseProfile.identity.name || null,
      stableToken: canonicalTalentSearchIdentity(document.candidateId)
        .identityToken,
    };
  });
  const canonicalRows = dedupe.documents.map((document) => ({
    token: canonicalTalentSearchIdentity(document.candidateId).identityToken,
    name: normalize(document.candidateName),
    flags: flags(document.candidateName),
    sourceIds: document.sourceCandidateIds?.length
      ? document.sourceCandidateIds
      : [document.candidateId],
  }));
  const visibleTokens = new Set([
    "#757B32",
    "#A8CCB8",
    "#0BD318",
    "#10B26F",
    "#DD0849",
    "#B975E8",
    "#F59634",
    "#9BF40A",
    "#8CD922",
    "#887BE4",
    "#4F9B60",
    "#C551A3",
    "#3689AD",
    "#925907",
    "#ED8494",
    "#9D94FF",
    "#5CD19D",
    "#FD1174",
  ]);
  const suspicious = canonicalRows.filter(
    (row) => row.name && row.flags.length,
  );
  const malformed = suspicious.filter((row) =>
    row.flags.some((flag) => flag !== "appendedMonthOrDate"),
  );
  const dateLikeNamesForManualReview = suspicious.filter(
    (row) => row.flags.length === 1 && row.flags[0] === "appendedMonthOrDate",
  );
  const tokenGroups = new Map<string, string[]>();
  for (const row of canonicalRows)
    tokenGroups.set(row.token, [
      ...(tokenGroups.get(row.token) || []),
      ...row.sourceIds,
    ]);
  const tokenCollisionCount = [...tokenGroups].filter(
    ([token]) => canonicalRows.filter((row) => row.token === token).length > 1,
  ).length;
  const inconsistentMergeGroups = canonicalRows.filter((row) => {
    if (new Set(row.sourceIds).size <= 1) return false;
    const names = new Set(
      row.sourceIds
        .map((id) => {
          const raw = rawById.get(id);
          return raw
            ? normalize(
                normalizeActualCandidateSchema({ ...raw, id }).enterpriseProfile
                  .identity.name,
              ).toLocaleLowerCase()
            : "";
        })
        .filter(Boolean),
    );
    return names.size > 1;
  });
  console.log(
    JSON.stringify(
      {
        datasetRevision: dataset.revision,
        indexedRows: dataset.documents.length,
        canonicalPeople: canonicalRows.length,
        traces,
        audit: {
          canonicalNamesAvailable: canonicalRows.filter((row) => row.name)
            .length,
          canonicalNamesUnavailable: canonicalRows.filter((row) => !row.name)
            .length,
          confirmedMalformedCanonicalNames: malformed.length,
          confirmedMalformedVisibleNames: malformed.filter((row) =>
            visibleTokens.has(row.token),
          ).length,
          dateLikeExplicitNamesReviewed: dateLikeNamesForManualReview.length,
          categories: Object.fromEntries(
            Object.keys(suspiciousRules).map((key) => [
              key,
              suspicious.filter((row) => row.flags.includes(key)).length,
            ]),
          ),
          remainingReviewItems: dateLikeNamesForManualReview.map(
            ({ token, name, flags }) => ({ token, name, flags }),
          ),
          tokenCollisions: tokenCollisionCount,
          canonicalMergeGroups: canonicalRows.filter(
            (row) => new Set(row.sourceIds).size > 1,
          ).length,
          mergeGroupsWithSourceNameVariants: inconsistentMergeGroups.length,
          sourceNameVariantGroupsForProvenanceReview:
            inconsistentMergeGroups.map((row) => ({
              token: row.token,
              sourceNames: [
                ...new Set(
                  row.sourceIds
                    .map((id) => {
                      const raw = rawById.get(id);
                      return raw
                        ? normalize(
                            normalizeActualCandidateSchema({ ...raw, id })
                              .enterpriseProfile.identity.name,
                          )
                        : "";
                    })
                    .filter(Boolean),
                ),
              ],
            })),
        },
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
