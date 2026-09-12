export type SearchSnapshotRequest<TIntent, TFilters, TMode> = Readonly<{
  query: string;
  intent: TIntent;
  filters: TFilters;
  matchQuality: TMode;
  minimumScore: number;
  searchKey: string;
}>;

export type CommittedSearchSnapshot<TIntent, TFilters, TMode, TResponse> = SearchSnapshotRequest<TIntent, TFilters, TMode> & Readonly<{
  response: TResponse;
}>;

export type SearchSnapshotState<TIntent, TFilters, TMode, TResponse> = Readonly<{
  latestRequestId: number;
  pending: Readonly<{ requestId: number; request: SearchSnapshotRequest<TIntent, TFilters, TMode> }> | null;
  committed: CommittedSearchSnapshot<TIntent, TFilters, TMode, TResponse> | null;
  error: string | null;
}>;

export function beginSearchSnapshot<TIntent, TFilters, TMode, TResponse>(
  state: SearchSnapshotState<TIntent, TFilters, TMode, TResponse>,
  requestId: number,
  request: SearchSnapshotRequest<TIntent, TFilters, TMode>,
): SearchSnapshotState<TIntent, TFilters, TMode, TResponse> {
  return { ...state, latestRequestId: requestId, pending: { requestId, request }, error: null };
}

export function commitSearchSnapshot<TIntent, TFilters, TMode, TResponse>(
  state: SearchSnapshotState<TIntent, TFilters, TMode, TResponse>,
  requestId: number,
  response: TResponse,
): SearchSnapshotState<TIntent, TFilters, TMode, TResponse> {
  if (!state.pending || state.latestRequestId !== requestId || state.pending.requestId !== requestId) return state;
  return { ...state, pending: null, committed: { ...state.pending.request, response }, error: null };
}

export function failSearchSnapshot<TIntent, TFilters, TMode, TResponse>(
  state: SearchSnapshotState<TIntent, TFilters, TMode, TResponse>,
  requestId: number,
  error: string,
): SearchSnapshotState<TIntent, TFilters, TMode, TResponse> {
  if (!state.pending || state.latestRequestId !== requestId || state.pending.requestId !== requestId) return state;
  return { ...state, pending: null, error };
}