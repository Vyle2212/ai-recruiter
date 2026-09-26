-- READ-ONLY verification after the supervised claim/provenance migration.
begin transaction read only;

do $readback$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from (values
    ('profile_source_state'),('profile_confirmation_status'),
    ('candidate_confirmed_at'),('claimed_by_candidate_at')
  ) expected(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'candidates'
      and c.column_name = expected.column_name
  );
  if v_missing <> 0 then raise exception 'candidate lifecycle columns missing: %', v_missing; end if;
  if has_function_privilege('anon','private.claim_candidate_profile()','execute') then
    raise exception 'candidate claim RPC remains callable by anon/public';
  end if;
  if has_function_privilege('authenticated','private.claim_candidate_profile()','execute') then
    raise exception 'candidate claim is exposed before production signup acceptance';
  end if;
end
$readback$;

rollback;
