-- No rows means the exact private-reference uniqueness guard is installed.
select 'private_source_index_missing_or_changed' as finding
where not exists (
  select 1 from pg_catalog.pg_indexes
  where schemaname = 'public' and tablename = 'candidates'
    and indexname = 'candidates_private_original_source_unique'
    and indexdef like 'CREATE UNIQUE INDEX%ON public.candidates USING btree (source_file)%'
    and indexdef like '%WHERE (source_file ~~ ''candidate-original-cvs/%''::text)%'
)
union all
select 'private_source_duplicate_reference'
where exists (
  select 1 from public.candidates
  where source_file like 'candidate-original-cvs/%'
  group by source_file having count(*) > 1
);
