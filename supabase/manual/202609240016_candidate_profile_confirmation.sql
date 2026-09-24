-- MANUAL, REVIEWED-RUN ONLY. DO NOT APPLY FROM CI.
-- Confirms one candidate-owned profile and replaces its exact search-index row
-- in the same transaction. Requires production Auth, profile claim, forced RLS
-- and the candidate-owned CV update RPC to have passed their readbacks first.
begin;

do $preflight$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.candidate_accounts') is null
     or to_regclass('public.candidates') is null
     or to_regclass('public.candidate_search_index') is null then
    raise exception 'candidate_profile_confirmation_preflight_missing_dependency';
  end if;
  if exists (
    select 1
    from (values
      ('profile_confirmation_status'),('candidate_confirmed_at'),
      ('profile_source_type'),('profile_source_state'),
      ('extraction_coverage'),('extraction_coverage_status')
    ) required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'candidates'
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'candidate_profile_confirmation_preflight_profile_fields_missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles'
      and column_name = 'email'
  ) then
    raise exception 'candidate_profile_confirmation_preflight_verified_email_missing';
  end if;
  if exists (
    select 1
    from (values
      ('public.candidates'::regclass),
      ('public.candidate_search_index'::regclass),
      ('public.user_profiles'::regclass),
      ('public.candidate_accounts'::regclass)
    ) required(relation_oid)
    join pg_catalog.pg_class c on c.oid = required.relation_oid
    where not c.relrowsecurity or not c.relforcerowsecurity
  ) then
    raise exception 'candidate_profile_confirmation_forced_rls_missing';
  end if;
end
$preflight$;

create or replace function public.apply_candidate_profile_confirmation(
  p_auth_user_id uuid,
  p_user_profile_id uuid,
  p_candidate_id uuid,
  p_expected_updated_at timestamptz,
  p_confirmed_at timestamptz,
  p_accuracy_consent boolean,
  p_sharing_consent boolean,
  p_payload jsonb,
  p_search_row jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_profile public.user_profiles%rowtype;
  v_account public.candidate_accounts%rowtype;
  v_candidate public.candidates%rowtype;
  v_payload_allowed constant text[] := array[
    'name','email','phone','current_title','current_company','location',
    'experience','sap_modules','primary_module','skills','projects',
    'education','certifications','languages'
  ];
  v_required_arrays constant text[] := array[
    'experience','sap_modules','skills','projects','education','languages'
  ];
  v_key text;
  v_index_columns text := '';
  v_index_values text := '';
  v_index_payload jsonb;
  v_updated_at timestamptz := statement_timestamp();
  v_result jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_search_row is null or jsonb_typeof(p_search_row) <> 'object' then
    raise exception 'candidate_profile_confirmation_payload_invalid';
  end if;
  if p_accuracy_consent is distinct from true
     or p_sharing_consent is distinct from true then
    raise exception 'candidate_profile_confirmation_consent_required';
  end if;
  if p_confirmed_at is null
     or p_confirmed_at < statement_timestamp() - interval '15 minutes'
     or p_confirmed_at > statement_timestamp() + interval '5 minutes' then
    raise exception 'candidate_profile_confirmation_timestamp_invalid';
  end if;

  for v_key in select jsonb_object_keys(p_payload) loop
    if not (v_key = any(v_payload_allowed)) then
      raise exception 'candidate_profile_confirmation_payload_key_invalid:%', v_key;
    end if;
  end loop;
  if coalesce(btrim(p_payload->>'name'), '') = ''
     or coalesce(btrim(p_payload->>'current_title'), '') = ''
     or coalesce(btrim(p_payload->>'current_company'), '') = ''
     or coalesce(btrim(p_payload->>'location'), '') = ''
     or (
       coalesce(btrim(p_payload->>'email'), '') = ''
       and coalesce(btrim(p_payload->>'phone'), '') = ''
     ) then
    raise exception 'candidate_profile_confirmation_core_fields_missing';
  end if;
  foreach v_key in array v_required_arrays loop
    if jsonb_typeof(p_payload->v_key) <> 'array'
       or jsonb_array_length(p_payload->v_key) = 0 then
      raise exception 'candidate_profile_confirmation_required_array_missing:%', v_key;
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'experience') row
    where coalesce(btrim(row->>'employer'), '') = ''
       or coalesce(btrim(row->>'title'), '') = ''
       or coalesce(btrim(row->>'start_date'), '') = ''
       or (row->>'start_date') !~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'
       or (length(row->>'start_date') >= 7 and substring(row->>'start_date', 6, 2) not between '01' and '12')
       or (length(row->>'start_date') = 10 and substring(row->>'start_date', 9, 2) not between '01' and '31')
       or (
         coalesce((row->>'current')::boolean, false) is true
         and coalesce(btrim(row->>'end_date'), '') <> ''
       )
       or (
         coalesce((row->>'current')::boolean, false) is not true
         and (
           coalesce(btrim(row->>'end_date'), '') = ''
           or (row->>'end_date') !~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'
           or (length(row->>'end_date') >= 7 and substring(row->>'end_date', 6, 2) not between '01' and '12')
           or (length(row->>'end_date') = 10 and substring(row->>'end_date', 9, 2) not between '01' and '31')
         )
       )
       or (
         coalesce(btrim(row->>'end_date'), '') <> ''
         and left(row->>'end_date', 4) < left(row->>'start_date', 4)
       )
       or (
         length(row->>'start_date') >= 7 and length(row->>'end_date') >= 7
         and left(row->>'end_date', 7) < left(row->>'start_date', 7)
       )
  ) then
    raise exception 'candidate_profile_confirmation_employment_incomplete';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'projects') row
    where (
        coalesce(btrim(row->>'project'), '') = ''
        and coalesce(btrim(row->>'client'), '') = ''
      )
      or coalesce(btrim(row->>'role'), '') = ''
      or coalesce(btrim(row->>'start_date'), '') = ''
      or (row->>'start_date') !~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'
      or (length(row->>'start_date') >= 7 and substring(row->>'start_date', 6, 2) not between '01' and '12')
      or (length(row->>'start_date') = 10 and substring(row->>'start_date', 9, 2) not between '01' and '31')
      or (
        coalesce((row->>'current')::boolean, false) is true
        and coalesce(btrim(row->>'end_date'), '') <> ''
      )
      or (
        coalesce((row->>'current')::boolean, false) is not true
        and (
          coalesce(btrim(row->>'end_date'), '') = ''
          or (row->>'end_date') !~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'
          or (length(row->>'end_date') >= 7 and substring(row->>'end_date', 6, 2) not between '01' and '12')
          or (length(row->>'end_date') = 10 and substring(row->>'end_date', 9, 2) not between '01' and '31')
        )
      )
      or (
        coalesce(btrim(row->>'end_date'), '') <> ''
        and left(row->>'end_date', 4) < left(row->>'start_date', 4)
      )
      or (
        length(row->>'start_date') >= 7 and length(row->>'end_date') >= 7
        and left(row->>'end_date', 7) < left(row->>'start_date', 7)
      )
  ) then
    raise exception 'candidate_profile_confirmation_project_incomplete';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'education') row
    where coalesce(btrim(row->>'institution'), '') = ''
      and coalesce(btrim(row->>'qualification'), '') = ''
      and coalesce(btrim(row->>'field_of_study'), '') = ''
  ) then
    raise exception 'candidate_profile_confirmation_education_incomplete';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'languages') row
    where coalesce(btrim(row->>'language'), '') = ''
  ) then
    raise exception 'candidate_profile_confirmation_language_incomplete';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_payload->'sap_modules') item
    where coalesce(btrim(item), '') = ''
  ) or exists (
    select 1 from jsonb_array_elements_text(p_payload->'skills') item
    where coalesce(btrim(item), '') = ''
  ) then
    raise exception 'candidate_profile_confirmation_skill_incomplete';
  end if;

  select * into v_profile
  from public.user_profiles
  where id = p_user_profile_id and auth_user_id = p_auth_user_id
  for update;
  if not found or v_profile.role <> 'candidate' or v_profile.status <> 'active'
     or v_profile.candidate_id is distinct from p_candidate_id then
    raise exception 'candidate_profile_confirmation_ownership_invalid';
  end if;
  if lower(btrim(p_payload->>'email')) is distinct from lower(btrim(v_profile.email)) then
    raise exception 'candidate_profile_confirmation_verified_email_mismatch';
  end if;
  select * into v_account
  from public.candidate_accounts
  where user_profile_id = p_user_profile_id and candidate_id = p_candidate_id
  for update;
  if not found or v_account.status <> 'active' then
    raise exception 'candidate_profile_confirmation_mapping_invalid';
  end if;
  select * into v_candidate
  from public.candidates
  where id = p_candidate_id
  for update;
  if not found or v_candidate.updated_at is distinct from p_expected_updated_at then
    raise exception 'candidate_profile_confirmation_stale_version';
  end if;

  update public.candidates as c set
    name = (jsonb_populate_record(null::public.candidates, p_payload)).name,
    email = (jsonb_populate_record(null::public.candidates, p_payload)).email,
    phone = (jsonb_populate_record(null::public.candidates, p_payload)).phone,
    current_title = (jsonb_populate_record(null::public.candidates, p_payload)).current_title,
    current_company = (jsonb_populate_record(null::public.candidates, p_payload)).current_company,
    location = (jsonb_populate_record(null::public.candidates, p_payload)).location,
    experience = (jsonb_populate_record(null::public.candidates, p_payload)).experience,
    sap_modules = (jsonb_populate_record(null::public.candidates, p_payload)).sap_modules,
    primary_module = (jsonb_populate_record(null::public.candidates, p_payload)).primary_module,
    skills = (jsonb_populate_record(null::public.candidates, p_payload)).skills,
    projects = (jsonb_populate_record(null::public.candidates, p_payload)).projects,
    education = (jsonb_populate_record(null::public.candidates, p_payload)).education,
    certifications = (jsonb_populate_record(null::public.candidates, p_payload)).certifications,
    languages = (jsonb_populate_record(null::public.candidates, p_payload)).languages,
    status = 'active',
    extraction_coverage_status = 'complete_for_validation',
    extraction_coverage = coalesce(c.extraction_coverage, '{}'::jsonb)
      || jsonb_build_object(
        'candidate_confirmation', jsonb_build_object(
          'accuracy_consent', true,
          'sharing_consent', true,
          'confirmed_at', p_confirmed_at
        )
      ),
    profile_source_type = 'candidate_confirmed',
    profile_confirmation_status = 'candidate_confirmed',
    candidate_confirmed_at = p_confirmed_at,
    updated_at = v_updated_at,
    profile_source_state = coalesce(c.profile_source_state, '{}'::jsonb)
    || jsonb_build_object(
      'origin', 'candidate_confirmed',
      'field_sources', coalesce(c.profile_source_state->'field_sources', '{}'::jsonb)
      || jsonb_build_object(
        'name','candidate_confirmed','email','candidate_confirmed',
        'phone','candidate_confirmed','current_title','candidate_confirmed',
        'current_company','candidate_confirmed','location','candidate_confirmed',
        'experience','candidate_confirmed','sap_modules','candidate_confirmed',
        'skills','candidate_confirmed','projects','candidate_confirmed',
        'education','candidate_confirmed','certifications','candidate_confirmed',
        'languages','candidate_confirmed'
      ),
      'confirmation', jsonb_build_object(
        'accuracy_consent', true,
        'sharing_consent', true,
        'confirmed_at', p_confirmed_at,
        'auth_user_id', p_auth_user_id
      )
    )
  where c.id = p_candidate_id
  returning to_jsonb(c.*) into v_result;

  v_index_payload := p_search_row || jsonb_build_object(
    'candidate_id', p_candidate_id,
    'source_updated_at', v_updated_at,
    'updated_at', v_updated_at
  );
  if v_index_payload->>'candidate_id' is distinct from p_candidate_id::text
     or coalesce(btrim(v_index_payload->>'display_name'), '') = ''
     or coalesce(btrim(v_index_payload->>'display_title'), '') = ''
     or coalesce(btrim(v_index_payload->>'display_company'), '') = ''
     or upper(coalesce(btrim(v_index_payload->>'primary_module'), ''))
        in ('','UNKNOWN','SAP','SAP_GENERAL','GENERAL_SAP')
     or coalesce((v_index_payload->>'quality_score')::numeric, 0) < 55
     or coalesce((v_index_payload->>'contactable')::boolean, false) is not true then
    raise exception 'candidate_profile_confirmation_search_row_invalid';
  end if;
  for v_key in select jsonb_object_keys(v_index_payload) order by 1 loop
    if not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = 'public.candidate_search_index'::regclass
        and attname = v_key and attnum > 0 and not attisdropped
        and attgenerated = ''
    ) then
      raise exception 'candidate_profile_confirmation_search_key_invalid:%', v_key;
    end if;
    v_index_columns := concat_ws(', ', nullif(v_index_columns, ''), format('%I', v_key));
    v_index_values := concat_ws(
      ', ', nullif(v_index_values, ''),
      format('(jsonb_populate_record(null::public.candidate_search_index, $1)).%I', v_key)
    );
  end loop;
  delete from public.candidate_search_index where candidate_id = p_candidate_id;
  execute format(
    'insert into public.candidate_search_index (%s) select %s',
    v_index_columns, v_index_values
  ) using v_index_payload;

  if (select count(*) from public.candidate_search_index where candidate_id = p_candidate_id) <> 1 then
    raise exception 'candidate_profile_confirmation_index_readback_mismatch';
  end if;
  return jsonb_build_object(
    'id', p_candidate_id,
    'profile_confirmation_status', v_result->>'profile_confirmation_status',
    'candidate_confirmed_at', v_result->>'candidate_confirmed_at',
    'updated_at', v_result->>'updated_at',
    'search_index_rows', 1
  );
end
$function$;

revoke all on function public.apply_candidate_profile_confirmation(
  uuid,uuid,uuid,timestamptz,timestamptz,boolean,boolean,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function public.apply_candidate_profile_confirmation(
  uuid,uuid,uuid,timestamptz,timestamptz,boolean,boolean,jsonb,jsonb
) to service_role;

commit;
