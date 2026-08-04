import type {
  CandidateSearchV2Request,
} from "./candidateSearchV2Types";

export type NormalizedCandidateSearchV2Request = {
  query: string;
  terms: string[];

  mode:
    | "keyword"
    | "semantic"
    | "hybrid"
    | "jd_match";

  filters:
    NonNullable<
      CandidateSearchV2Request["filters"]
    >;

  page: number;
  pageSize: number;

  semanticWeight: number;
  keywordWeight: number;
  qualityWeight: number;
  recencyWeight: number;

  minimumScore: number;
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function normalizeArray(
  values:
    | string[]
    | undefined,
) {
  return Array.from(
    new Set(
      (
        values ||
        []
      )
        .map(
          (value) =>
            value
              .trim()
              .toLowerCase(),
        )
        .filter(Boolean),
    ),
  );
}

export function tokenizeCandidateSearchV2Query(
  value: string,
) {
  return Array.from(
    new Set(
      value
        .normalize("NFKC")
        .toLowerCase()
        .replace(
          /[^a-z0-9+#./\-\s]/g,
          " ",
        )
        .split(/\s+/)
        .map(
          (term) =>
            term.trim(),
        )
        .filter(
          (term) =>
            term.length >= 2,
        ),
    ),
  );
}

export function normalizeCandidateSearchV2Request(
  request:
    CandidateSearchV2Request,
): NormalizedCandidateSearchV2Request {
  const query =
    String(
      request.query ||
      "",
    )
      .normalize("NFKC")
      .trim();

  const page =
    Number.isInteger(
      request.page,
    ) &&
    Number(request.page) > 0
      ? Number(
          request.page,
        )
      : 1;

  const pageSize =
    Number.isInteger(
      request.pageSize,
    )
      ? clamp(
          Number(
            request.pageSize,
          ),
          1,
          100,
        )
      : 20;

  return {
    query,

    terms:
      tokenizeCandidateSearchV2Query(
        query,
      ),

    mode:
      request.mode ||
      "hybrid",

    filters: {
      ...(
        request.filters ||
        {}
      ),

      countries:
        normalizeArray(
          request.filters
            ?.countries,
        ),

      locations:
        normalizeArray(
          request.filters
            ?.locations,
        ),

      currentTitles:
        normalizeArray(
          request.filters
            ?.currentTitles,
        ),

      currentEmployers:
        normalizeArray(
          request.filters
            ?.currentEmployers,
        ),

      skills:
        normalizeArray(
          request.filters
            ?.skills,
        ),

      sapModules:
        normalizeArray(
          request.filters
            ?.sapModules,
        ),

      industries:
        normalizeArray(
          request.filters
            ?.industries,
        ),

      languages:
        normalizeArray(
          request.filters
            ?.languages,
        ),

      workflowStatuses:
        normalizeArray(
          request.filters
            ?.workflowStatuses,
        ),

      qualityStatuses:
        normalizeArray(
          request.filters
            ?.qualityStatuses,
        ),

      workAuthorization:
        normalizeArray(
          request.filters
            ?.workAuthorization,
        ),
    },

    page,
    pageSize,

    semanticWeight:
      clamp(
        request.semanticWeight ??
        0.28,
        0,
        1,
      ),

    keywordWeight:
      clamp(
        request.keywordWeight ??
        0.34,
        0,
        1,
      ),

    qualityWeight:
      clamp(
        request.qualityWeight ??
        0.1,
        0,
        1,
      ),

    recencyWeight:
      clamp(
        request.recencyWeight ??
        0.05,
        0,
        1,
      ),

    minimumScore:
      clamp(
        request.minimumScore ??
        0,
        0,
        100,
      ),
  };
}