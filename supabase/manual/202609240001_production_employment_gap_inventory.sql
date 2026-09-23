-- READ-ONLY PRODUCTION EMPLOYMENT GAP INVENTORY.
-- Emits aggregate counts only. Candidate IDs, names, contact details, source
-- filenames and CV text are never returned.
--
-- The categories are mutually exclusive heuristic review queues. They identify
-- the next review surface; they do not adjudicate employers or authorize a
-- backfill.

begin transaction isolation level repeatable read read only;

do $$
begin
  if to_regclass('public.candidates') is null then
    raise exception 'Employment gap inventory refused: missing public.candidates';
  end if;

  if exists (
    select 1
    from public.candidates
    where jsonb_typeof(
      parsed_json->'canonical_candidate'->'payload'->'employmentHistory'
    ) is distinct from 'array'
  ) then
    raise exception 'Employment gap inventory refused: canonical employment array missing';
  end if;
end
$$;

with
candidate_source as (
  select
    parsed_json->'canonical_candidate'->>'parser_version' as parser_version,
    parsed_json->'canonical_candidate'->'payload'->'employmentHistory' as employment,
    concat_ws(
      E'\n',
      coalesce(raw_text, ''),
      coalesce(resume_text, ''),
      coalesce(raw_cv, '')
    ) as full_source
  from public.candidates
),
candidate_state as (
  select
    parser_version,
    employment,
    full_source,
    (
      regexp_split_to_array(
        full_source,
        '\m(references|referrals)\M',
        'i'
      )
    )[1] as source
  from candidate_source
),
population as (
  select
    count(*) as candidate_count,
    count(*) filter (where jsonb_array_length(employment) > 0) as employment_sources,
    count(*) filter (where jsonb_array_length(employment) = 0) as gap_sources,
    coalesce(sum(jsonb_array_length(employment)), 0) as employment_rows,
    count(*) filter (where length(full_source) > 0) as source_text_available
  from candidate_state
),
parser_versions as (
  select coalesce(
    jsonb_object_agg(version, rows order by version),
    '{}'::jsonb
  ) as value
  from (
    select coalesce(parser_version, '(missing)') as version, count(*) as rows
    from candidate_state
    group by coalesce(parser_version, '(missing)')
  ) grouped
),
classified as (
  select case
    when length(source) < 250 then 'short-or-missing-source'
    when source ~* (
      'Date[[:space:]]+Company Name[[:space:]]+Role'
      || '|From[[:space:]]+To[[:space:]]+Company'
      || '|Name of Company[[:space:]]+Scope'
      || '|Period[[:space:]]+Position[[:space:]]+(Company|Experience)'
      || '|Organi[sz]ation[[:space:]]+Designation'
      || '|Year[[:space:]]+Name of Employer'
    ) then 'headed-table-needs-layout-review'
    when source ~* '(Employer|Company Name|Organi[sz]ation)[[:space:]]*:'
      then 'explicit-employer-label-needs-field-review'
    when source ~* (
      '(employment history|career history|working experiences?'
      || '|work experience|professional experience).*?(19|20)[0-9]{2}'
    ) then 'near-heading-date-needs-boundary-review'
    when source ~* '(projects?|clients?|customers?)'
      then 'project-or-client-heavy-needs-employment-evidence'
    else 'other-narrative-or-layout-review'
  end as category
  from candidate_state
  where jsonb_array_length(employment) = 0
),
gap_groups as (
  select coalesce(
    jsonb_object_agg(category, sources order by category),
    '{}'::jsonb
  ) as value
  from (
    select category, count(*) as sources
    from classified
    group by category
  ) grouped
)
select jsonb_pretty(
  jsonb_build_object(
    'artifact', 'production_employment_gap_inventory_v1',
    'captured_at', transaction_timestamp(),
    'database', current_database(),
    'candidate_count', population.candidate_count,
    'stored_employment_sources', population.employment_sources,
    'stored_employment_rows', population.employment_rows,
    'stored_gap_sources', population.gap_sources,
    'source_text_available', population.source_text_available,
    'parser_versions', parser_versions.value,
    'gap_groups', gap_groups.value,
    'classification', 'heuristic review queues, not adjudicated causes',
    'contains_candidate_identifiers', false,
    'database_writes', 0
  )
) as employment_gap_inventory
from population, parser_versions, gap_groups;

commit;
