-- MANUAL PRODUCTION ADAPTER. Installing this function does not change candidate
-- or search-index rows. Do not install or call it until the isolated restore,
-- RLS cutover/readback and supervised release gates have passed.
--
-- The private request is built from the canonical TypeScript row builder. The
-- RPC locks both complete source sets, rejects any version or membership drift,
-- removes only the supplied unexpected index IDs, and verifies the exact
-- remaining set before the transaction can commit. Its response is aggregate
-- only and never serializes candidate identifiers.

create or replace function public.apply_candidate_search_index_exact_set_repair(
  p_request jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  candidate_version jsonb;
  index_version jsonb;
  expected_delete_count integer;
  expected_remaining_count integer;
  affected_rows integer;
  remaining_rows integer;
begin
  if jsonb_typeof(p_request) <> 'object'
    or p_request->>'artifact' <> 'candidate_search_index_exact_set_repair_v1'
    or coalesce(p_request->>'targetCommitSha', '') !~ '^[0-9a-f]{40}$'
    or coalesce(p_request->>'planFingerprint', '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_request->'candidateVersions') <> 'array'
    or jsonb_typeof(p_request->'indexVersions') <> 'array'
    or jsonb_typeof(p_request->'deleteCandidateIds') <> 'array'
  then
    raise exception 'Search index repair refused: invalid bound request';
  end if;

  expected_delete_count := coalesce((p_request->>'expectedDeleteCount')::integer, -1);
  expected_remaining_count := coalesce((p_request->>'expectedRemainingIndexCount')::integer, -1);
  if expected_delete_count <= 0
    or expected_delete_count <> jsonb_array_length(p_request->'deleteCandidateIds')
    or coalesce((p_request->>'expectedCandidateCount')::integer, -1)
      <> jsonb_array_length(p_request->'candidateVersions')
    or coalesce((p_request->>'expectedIndexCount')::integer, -1)
      <> jsonb_array_length(p_request->'indexVersions')
    or expected_remaining_count + expected_delete_count
      <> jsonb_array_length(p_request->'indexVersions')
  then
    raise exception 'Search index repair refused: aggregate count mismatch';
  end if;

  if (select count(*) <> count(distinct value)
      from jsonb_array_elements_text(p_request->'deleteCandidateIds'))
    or (select count(*) <> count(distinct item->>'candidateId')
        from jsonb_array_elements(p_request->'candidateVersions') items(item))
    or (select count(*) <> count(distinct item->>'candidateId')
        from jsonb_array_elements(p_request->'indexVersions') items(item))
  then
    raise exception 'Search index repair refused: duplicate identifiers';
  end if;

  -- SHARE rejects concurrent source updates. SHARE ROW EXCLUSIVE rejects all
  -- concurrent index writes while still allowing ordinary readers.
  lock table public.candidates in share mode;
  lock table public.candidate_search_index in share row exclusive mode;

  if (select count(*) from public.candidates)
      <> jsonb_array_length(p_request->'candidateVersions')
    or (select count(*) from public.candidate_search_index)
      <> jsonb_array_length(p_request->'indexVersions')
  then
    raise exception 'Search index repair refused: snapshot membership changed';
  end if;

  for candidate_version in
    select item
    from jsonb_array_elements(p_request->'candidateVersions') items(item)
    order by item->>'candidateId'
  loop
    if coalesce(candidate_version->>'candidateId', '') = ''
      or not exists (
        select 1
        from public.candidates candidate
        where candidate.id::text = candidate_version->>'candidateId'
          and candidate.updated_at is not distinct from
            case
              when candidate_version->>'updatedAt' is null then null
              else (candidate_version->>'updatedAt')::timestamptz
            end
      )
    then
      raise exception 'Search index repair refused: candidate snapshot changed';
    end if;
  end loop;

  for index_version in
    select item
    from jsonb_array_elements(p_request->'indexVersions') items(item)
    order by item->>'candidateId'
  loop
    if coalesce(index_version->>'candidateId', '') = ''
      or not exists (
        select 1
        from public.candidate_search_index search_row
        where search_row.candidate_id::text = index_version->>'candidateId'
          and search_row.source_updated_at is not distinct from
            case
              when index_version->>'sourceUpdatedAt' is null then null
              else (index_version->>'sourceUpdatedAt')::timestamptz
            end
          and search_row.updated_at is not distinct from
            case
              when index_version->>'updatedAt' is null then null
              else (index_version->>'updatedAt')::timestamptz
            end
      )
    then
      raise exception 'Search index repair refused: index snapshot changed';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements_text(p_request->'deleteCandidateIds') ids(candidate_id)
    where not exists (
      select 1
      from jsonb_array_elements(p_request->'indexVersions') versions(item)
      where item->>'candidateId' = ids.candidate_id
    )
  ) then
    raise exception 'Search index repair refused: deletion is outside bound index set';
  end if;

  delete from public.candidate_search_index search_row
  where search_row.candidate_id::text in (
    select value
    from jsonb_array_elements_text(p_request->'deleteCandidateIds')
  );
  get diagnostics affected_rows = row_count;
  if affected_rows <> expected_delete_count then
    raise exception 'Search index repair refused: deletion count mismatch';
  end if;

  select count(*) into remaining_rows from public.candidate_search_index;
  if remaining_rows <> expected_remaining_count
    or exists (
      select 1
      from jsonb_array_elements_text(p_request->'deleteCandidateIds') ids(candidate_id)
      join public.candidate_search_index search_row
        on search_row.candidate_id::text = ids.candidate_id
    )
    or exists (
      select 1
      from public.candidate_search_index search_row
      where not exists (
        select 1
        from jsonb_array_elements(p_request->'indexVersions') versions(item)
        where item->>'candidateId' = search_row.candidate_id::text
          and not (p_request->'deleteCandidateIds') ? (item->>'candidateId')
      )
    )
  then
    raise exception 'Search index repair refused: exact readback mismatch';
  end if;

  return jsonb_build_object(
    'artifact', 'candidate_search_index_exact_set_repair_execution_v1',
    'targetCommitSha', p_request->>'targetCommitSha',
    'planFingerprint', p_request->>'planFingerprint',
    'rowsDeleted', affected_rows,
    'rowsRemaining', remaining_rows,
    'exactReadbackVerified', true,
    'transactionCommitted', true,
    'privacy', jsonb_build_object(
      'candidateIdentifiersSerialized', 0,
      'candidateContactsSerialized', 0,
      'cvContentsSerialized', 0
    )
  );
end
$$;

revoke all on function public.apply_candidate_search_index_exact_set_repair(jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_candidate_search_index_exact_set_repair(jsonb)
  to service_role;
