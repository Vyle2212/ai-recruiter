-- MANUAL PRODUCTION ADAPTER. This file defines the single-transaction RPC
-- required by the reviewed additive employment promotion contract. Installing
-- it does not promote candidate data. Do not install or call it until the
-- exact application SHA, private reviewed manifest, verified backup and
-- authenticated acceptance have all passed their release gates.
--
-- The function is SECURITY INVOKER and executable only by service_role. It
-- locks the complete batch before the first update, preserves every existing
-- employment row in order, rejects stale source state and rolls back the whole
-- RPC on any exception. Candidate identifiers and employment rows are inputs
-- only; the result contains aggregate counts.

create or replace function public.apply_reviewed_employment_promotion_batch(
  p_request jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  operation jsonb;
  locked_candidate record;
  expected_history jsonb;
  promoted_history jsonb;
  promoted_prefix jsonb;
  expected_updated_at timestamptz;
  next_updated_at timestamptz;
  affected_rows integer;
  operation_count integer;
  addition_count integer;
  readback_count integer := 0;
  invalidated_index_rows integer := 0;
begin
  if jsonb_typeof(p_request) <> 'object'
    or p_request->>'artifact' <> 'reviewed_employment_promotion_rpc_v1'
    or coalesce(p_request->>'targetCommitSha', '') !~ '^[0-9a-fA-F]{40}$'
    or coalesce(p_request->>'manifestFingerprint', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_request->>'preflightFingerprint', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_request->>'candidateSetFingerprint', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_request->>'sourceStateFingerprint', '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_request->'operations') <> 'array'
  then
    raise exception 'Employment promotion refused: invalid bound request';
  end if;

  operation_count := jsonb_array_length(p_request->'operations');
  if operation_count = 0
    or operation_count <> coalesce((p_request->>'entries')::integer, -1)
  then
    raise exception 'Employment promotion refused: invalid operation count';
  end if;

  if (
    select count(*) <> count(distinct item->>'candidateId')
      or count(*) <> count(*) filter (
        where coalesce(item->>'candidateId', '') <> ''
      )
    from jsonb_array_elements(p_request->'operations') as items(item)
  ) then
    raise exception 'Employment promotion refused: duplicate or missing candidate ID';
  end if;

  select coalesce(sum((item->>'addedRows')::integer), 0)
    into addition_count
  from jsonb_array_elements(p_request->'operations') as items(item);
  if addition_count <> coalesce((p_request->>'additions')::integer, -1)
  then
    raise exception 'Employment promotion refused: addition count mismatch';
  end if;

  -- Lock every source row in a stable order before any update. This prevents a
  -- later candidate failure from leaving an earlier candidate committed and
  -- reduces deadlock risk when two operators race on overlapping batches.
  for operation in
    select item
    from jsonb_array_elements(p_request->'operations') as items(item)
    order by item->>'candidateId'
  loop
    if jsonb_typeof(operation->'expectedEmploymentHistory') <> 'array'
      or jsonb_typeof(operation->'employmentHistory') <> 'array'
      or coalesce((operation->>'addedRows')::integer, 0) <= 0
      or coalesce(operation->>'queue', '') not in (
        'empty_to_populated_review',
        'existing_additive_review'
      )
    then
      raise exception 'Employment promotion refused: invalid additive operation';
    end if;

    expected_history := operation->'expectedEmploymentHistory';
    promoted_history := operation->'employmentHistory';
    if jsonb_array_length(promoted_history)
      <> jsonb_array_length(expected_history) + (operation->>'addedRows')::integer
    then
      raise exception 'Employment promotion refused: promoted row count mismatch';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(expected_history || promoted_history) as rows(item)
      where jsonb_typeof(item) <> 'object'
    ) then
      raise exception 'Employment promotion refused: employment rows must be objects';
    end if;

    select coalesce(jsonb_agg(item order by ordinal), '[]'::jsonb)
      into promoted_prefix
    from jsonb_array_elements(promoted_history) with ordinality as rows(item, ordinal)
    where ordinal <= jsonb_array_length(expected_history);
    if promoted_prefix <> expected_history then
      raise exception 'Employment promotion refused: existing employment changed';
    end if;

    begin
      expected_updated_at := (operation->>'expectedUpdatedAt')::timestamptz;
    exception when others then
      raise exception 'Employment promotion refused: invalid expected source version';
    end;

    select
      c.id::text as candidate_id,
      c.updated_at,
      c.parsed_json #> '{canonical_candidate,payload,employmentHistory}' as employment_history
      into locked_candidate
    from public.candidates c
    where c.id::text = operation->>'candidateId'
    for update;

    if not found then
      raise exception 'Employment promotion refused: candidate is missing';
    end if;
    if locked_candidate.updated_at <> expected_updated_at
      or locked_candidate.employment_history is null
      or jsonb_typeof(locked_candidate.employment_history) <> 'array'
      or locked_candidate.employment_history <> expected_history
    then
      raise exception 'Employment promotion refused: locked source state changed';
    end if;
  end loop;

  -- All sources are now locked and validated. Updating parsed_json also advances
  -- the source version. Existing search rows are removed later in this same
  -- transaction so stale canonical employment cannot remain searchable.
  for operation in
    select item
    from jsonb_array_elements(p_request->'operations') as items(item)
    order by item->>'candidateId'
  loop
    expected_updated_at := (operation->>'expectedUpdatedAt')::timestamptz;
    promoted_history := operation->'employmentHistory';
    next_updated_at := greatest(
      clock_timestamp(),
      expected_updated_at + interval '1 microsecond'
    );

    update public.candidates c
    set parsed_json = jsonb_set(
          c.parsed_json,
          '{canonical_candidate,payload,employmentHistory}',
          promoted_history,
          false
        ),
        updated_at = next_updated_at
    where c.id::text = operation->>'candidateId'
      and c.updated_at = expected_updated_at
      and c.parsed_json #> '{canonical_candidate,payload,employmentHistory}'
        = operation->'expectedEmploymentHistory';
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'Employment promotion refused: optimistic update mismatch';
    end if;
  end loop;

  delete from public.candidate_search_index search_row
  where search_row.candidate_id::text in (
    select item->>'candidateId'
    from jsonb_array_elements(p_request->'operations') as items(item)
  );
  get diagnostics invalidated_index_rows = row_count;

  for operation in
    select item
    from jsonb_array_elements(p_request->'operations') as items(item)
    order by item->>'candidateId'
  loop
    select
      c.updated_at,
      c.parsed_json #> '{canonical_candidate,payload,employmentHistory}' as employment_history
      into locked_candidate
    from public.candidates c
    where c.id::text = operation->>'candidateId';
    if not found
      or locked_candidate.updated_at <= (operation->>'expectedUpdatedAt')::timestamptz
      or locked_candidate.employment_history <> operation->'employmentHistory'
    then
      raise exception 'Employment promotion refused: exact readback mismatch';
    end if;
    readback_count := readback_count + 1;
  end loop;

  return jsonb_build_object(
    'artifact', 'reviewed_employment_promotion_execution_v1',
    'targetCommitSha', p_request->>'targetCommitSha',
    'manifestFingerprint', p_request->>'manifestFingerprint',
    'candidatesUpdated', operation_count,
    'additionsWritten', addition_count,
    'readbacksVerified', readback_count,
    'searchIndexRowsInvalidated', invalidated_index_rows,
    'transactionCommitted', true,
    'privacy', jsonb_build_object(
      'candidateIdentifiersSerialized', 0,
      'employmentRowsSerialized', 0
    )
  );
end
$$;

revoke all on function public.apply_reviewed_employment_promotion_batch(jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_reviewed_employment_promotion_batch(jsonb)
  to service_role;
