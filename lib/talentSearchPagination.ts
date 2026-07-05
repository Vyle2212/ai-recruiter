export type TalentSearchPaginationInput = {
  totalCandidates?: number;
  totalMatched: number;
  returnedCount: number;
  pageSize?: number;
  page?: number;
  limit?: number;
  offset?: number;
};

export type TalentSearchPaginationMeta = TalentSearchPaginationInput & {
  totalCandidates: number;
  totalMatched: number;
  returnedCount: number;
  pageSize: number;
  limit: number;
  offset: number;
  currentPage: number;
  page: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  hasMore: boolean;
};

function positiveInt(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function nonNegativeInt(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) && Number(value) >= 0 ? Math.floor(Number(value)) : fallback;
}

export function buildTalentSearchPaginationMeta(input: TalentSearchPaginationInput): TalentSearchPaginationMeta {
  const pageSize = positiveInt(input.pageSize ?? input.limit, 10);
  const requestedPage = positiveInt(input.page, 0);
  const offset = requestedPage > 0
    ? (requestedPage - 1) * pageSize
    : nonNegativeInt(input.offset, 0);
  const totalMatched = nonNegativeInt(input.totalMatched, 0);
  const totalCandidates = nonNegativeInt(input.totalCandidates ?? totalMatched, totalMatched);
  const returnedCount = nonNegativeInt(input.returnedCount, 0);
  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const currentPage = Math.min(totalPages, Math.max(1, Math.floor(offset / pageSize) + 1));
  const hasNext = currentPage < totalPages;
  return {
    ...input,
    totalCandidates,
    totalMatched,
    returnedCount,
    pageSize,
    limit: pageSize,
    offset,
    currentPage,
    page: currentPage,
    totalPages,
    hasPrevious: currentPage > 1,
    hasNext,
    hasMore: hasNext,
  };
}
