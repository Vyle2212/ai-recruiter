import {
  candidatePassesSearchV2Filters,
} from "./candidateSearchV2Filters";

import {
  normalizeCandidateSearchV2Request,
} from "./candidateSearchV2Request";

import {
  candidateHasSearchV2PrimaryModuleRelevance,
} from "./candidateSearchV2ModuleRelevance";

import {
  scoreCandidateSearchV2Document,
} from "./candidateSearchV2Scoring";

import type {
  CandidateSearchV2Document,
  CandidateSearchV2Request,
  CandidateSearchV2Response,
} from "./candidateSearchV2Types";

export function searchCandidatesV2(
  documents:
    CandidateSearchV2Document[],
  rawRequest:
    CandidateSearchV2Request,
): CandidateSearchV2Response {
  const request =
    normalizeCandidateSearchV2Request(
      rawRequest,
    );

  const filtered =
    documents.filter(
      (candidate) =>
        candidatePassesSearchV2Filters(
          candidate,
          request,
        ) &&
        candidateHasSearchV2PrimaryModuleRelevance(
          candidate,
          request,
        ),
    );

  const scored =
    filtered
      .map(
        (candidate) =>
          scoreCandidateSearchV2Document(
            candidate,
            request,
          ),
      )
      .filter(
        (result) =>
          result.score.finalScore >=
          request.minimumScore,
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.score.finalScore -
            left.score.finalScore ||
          right.score.skillScore -
            left.score.skillScore ||
          right.score.qualityScore -
            left.score.qualityScore ||
          left.candidateId.localeCompare(
            right.candidateId,
          ),
      );

  const startIndex =
    (
      request.page -
      1
    ) *
    request.pageSize;

  const results =
    scored.slice(
      startIndex,
      startIndex +
        request.pageSize,
    );

  return {
    generatedAt:
      new Date().toISOString(),

    request: {
      query:
        request.query,

      mode:
        request.mode,

      page:
        request.page,

      pageSize:
        request.pageSize,

      minimumScore:
        request.minimumScore,
    },

    summary: {
      totalDocuments:
        documents.length,

      totalMatched:
        scored.length,

      returned:
        results.length,

      page:
        request.page,

      pageSize:
        request.pageSize,
    },

    results,

    safety: {
      readOnly: true,
      candidateWrites: 0,
      workflowWrites: 0,
      automaticShortlists: 0,
      emailSends: 0,
    },
  };
}