-- MANUAL, REVIEWED-RUN ONLY. DO NOT APPLY FROM CI.
-- Installs the single-row candidate-owned CV update transaction. It requires
-- the production Auth foundation, profile-claim provenance and full-profile
-- fields to have passed their independent readbacks first.
begin;

do $preflight$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.candidate_accounts') is null
     or to_regclass('public.candidates') is null
     or to_regclass('public.candidate_search_index') is null then
    raise exception 'candidate_owned_cv_preflight_missing_dependency';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidates'
      and column_name = 'profile_confirmation_status'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidates'
      and column_name = 'profile_source_state'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidates'
      and column_name = 'extraction_coverage'
  ) then
    raise exception 'candidate_owned_cv_preflight_profile_fields_missing';
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
    raise exception 'candidate_owned_cv_preflight_forced_rls_missing';
  end if;
end
$preflight$;

create or replace function public.apply_candidate_owned_cv_update(
  p_auth_user_id uuid,
  p_user_profile_id uuid,
  p_candidate_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_profile public.user_profiles%rowtype;
  v_account public.candidate_accounts%rowtype;
  v_candidate public.candidates%rowtype;
  v_allowed constant text[] := array[
    'name','location','country','skills','years','raw_text','education',
    'certifications','languages','language_skills','projects','summary',
    'experience','resume_text','source_file','years_experience','company',
    'expected_salary','current_location','linkedin_url','current_title','raw_cv',
    'normalized_name','cv_hash','company_type','profile_quality_score',
    'is_from_consulting_firm','consulting_firm_evidence',
    'calculated_experience_months','extraction_confidence','extraction_notes',
    'sap_modules','project_types','sap_submodules','implementation_experience',
    'ams_support_experience','rollout_experience','migration_experience',
    'implementation_project_count','rollout_project_count',
    'ams_support_project_count','migration_project_count','total_project_count',
    'fico_project_count','s4hana_project_count','lead_role_count',
    'manager_role_count','consulting_project_count','end_user_project_count',
    'regional_project_count','apac_project_count','global_project_count',
    'client_workshop_count','fit_gap_count','blueprint_count','role_type',
    'ams_project_count','transformation_project_count','consulting_level',
    'regional_delivery_score','business_process_workshop_count',
    's4hana_workshop_count','presales_count','country_coverage_count',
    'multi_country_rollout_score','rfp_count','proposal_count',
    'solutioning_count','poc_count','s4_support_count',
    's4_implementation_count','s4_conversion_count','s4_greenfield_count',
    'primary_module','secondary_modules','module_authority_score',
    'module_authorities','implementation_authority','domain_authority',
    'project_ownership_score','finance_depth_score','consulting_dna',
    'employer_reputation','module_authority','consulting_dna_score',
    'employer_reputation_score','confidence','current_company','title','headline',
    'name_detected','title_detected','name_review_required',
    'title_review_required','years_review_required','extraction_coverage',
    'extraction_coverage_status'
  ];
  v_key text;
  v_assignments text := '';
  v_protected_fields integer := 0;
  v_result jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'candidate_owned_cv_payload_invalid';
  end if;
  if p_payload->>'profile_source_type' <> 'candidate_upload' then
    raise exception 'candidate_owned_cv_source_invalid';
  end if;
  if coalesce(p_payload->>'source_file', '') !~ (
    '^candidate-original-cvs/' || p_auth_user_id::text ||
    '/[0-9a-fA-F-]{36}[.](pdf|docx|txt)$'
  ) then
    raise exception 'candidate_owned_cv_object_ownership_invalid';
  end if;

  select * into v_profile
  from public.user_profiles
  where id = p_user_profile_id and auth_user_id = p_auth_user_id
  for update;
  if not found or v_profile.role <> 'candidate' or v_profile.status <> 'active'
     or v_profile.candidate_id is distinct from p_candidate_id then
    raise exception 'candidate_owned_cv_ownership_invalid';
  end if;

  select * into v_account
  from public.candidate_accounts
  where user_profile_id = p_user_profile_id and candidate_id = p_candidate_id
  for update;
  if not found or v_account.status <> 'active' then
    raise exception 'candidate_owned_cv_mapping_invalid';
  end if;

  select * into v_candidate
  from public.candidates
  where id = p_candidate_id
  for update;
  if not found then
    raise exception 'candidate_owned_cv_mapping_invalid';
  end if;
  if v_candidate.updated_at is distinct from p_expected_updated_at then
    raise exception 'candidate_owned_cv_stale_version';
  end if;

  for v_key in select jsonb_object_keys(p_payload) order by 1 loop
    if v_key in ('profile_source_type','parser_quality','extraction_missing_sections') then
      continue;
    end if;
    if not (v_key = any(v_allowed)) then
      raise exception 'candidate_owned_cv_payload_key_invalid:%', v_key;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = 'public.candidates'::regclass
        and attname = v_key and attnum > 0 and not attisdropped
    ) then
      raise exception 'candidate_owned_cv_column_missing:%', v_key;
    end if;
    if coalesce(v_candidate.profile_source_state->'field_sources'->>v_key, '')
       in ('candidate_confirmed','recruiter_approved') then
      v_protected_fields := v_protected_fields + 1;
      continue;
    end if;
    v_assignments := concat_ws(
      ', ',
      nullif(v_assignments, ''),
      format(
        '%1$I = (jsonb_populate_record(null::public.candidates, $1)).%1$I',
        v_key
      )
    );
  end loop;
  if v_assignments = '' then
    raise exception 'candidate_owned_cv_payload_empty';
  end if;

  execute format(
    'update public.candidates as c set %s,
       status = ''needs_review'',
       updated_at = statement_timestamp(),
       latest_cv_uploaded_at = statement_timestamp(),
       cv_version = coalesce(c.cv_version, 0) + 1,
       profile_source_type = ''candidate_upload'',
       profile_confirmation_status = ''claimed_incomplete'',
       candidate_confirmed_at = null,
       profile_source_state = jsonb_set(
         coalesce(c.profile_source_state, ''{}''::jsonb),
         ''{latest_cv_upload}'',
         jsonb_build_object(
           ''source'', ''candidate_upload'',
           ''updated_at'', statement_timestamp(),
           ''protected_fields_preserved'', $3
         ),
         true
       )
     where c.id = $2
     returning to_jsonb(c.*)',
    v_assignments
  ) using p_payload, p_candidate_id, v_protected_fields into v_result;

  if v_result is null
     or v_result->>'id' is distinct from p_candidate_id::text
     or v_result->>'source_file' is distinct from p_payload->>'source_file' then
    raise exception 'candidate_owned_cv_readback_mismatch';
  end if;

  -- A CV replacement is not searchable until required fields are fulfilled
  -- and explicitly confirmed. Remove any stale materialized search row in the
  -- same transaction so an older profile cannot leak through search.
  delete from public.candidate_search_index where candidate_id = p_candidate_id;

  return v_result || jsonb_build_object(
    'protected_fields_preserved', v_protected_fields,
    'search_index_rows_remaining', (
      select count(*) from public.candidate_search_index
      where candidate_id = p_candidate_id
    )
  );
end
$function$;

revoke all on function public.apply_candidate_owned_cv_update(
  uuid,uuid,uuid,timestamptz,jsonb
) from public, anon, authenticated;
grant execute on function public.apply_candidate_owned_cv_update(
  uuid,uuid,uuid,timestamptz,jsonb
) to service_role;

commit;
