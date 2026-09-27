-- Client-scoped candidate lookup. Apply after the client entitlement schema and
-- the candidates table exist. The API checks membership and plan entitlement;
-- this function independently constrains every row by client_candidate_access.
begin;

create index if not exists client_candidate_access_lookup_idx
  on public.client_candidate_access (client_id, candidate_id)
  where status = 'active';

create index if not exists candidates_client_lookup_fts_idx
  on public.candidates using gin (
    to_tsvector('simple'::regconfig,
      coalesce(name, '') || ' ' || coalesce(current_title, '') || ' ' || coalesce(current_company, ''))
  );

create or replace function public.client_candidate_lookup(
  p_client_id uuid, p_query text default '', p_after uuid default null,
  p_limit integer default 20
)
returns table (id uuid, name text, current_title text, current_company text)
language sql stable
set search_path = ''
as $function$
  select c.id, c.name::text, c.current_title::text, c.current_company::text
  from public.client_candidate_access a
  join public.candidates c on c.id = a.candidate_id
  where a.client_id = p_client_id and a.status = 'active'
    and (p_after is null or a.candidate_id > p_after)
    and (btrim(coalesce(p_query, '')) = '' or
      to_tsvector('simple'::regconfig,
        coalesce(c.name, '') || ' ' || coalesce(c.current_title, '') || ' ' || coalesce(c.current_company, ''))
      @@ plainto_tsquery('simple'::regconfig, left(p_query, 120)))
  order by a.candidate_id
  limit least(greatest(coalesce(p_limit, 20), 1), 51)
$function$;

revoke all on function public.client_candidate_lookup(uuid, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.client_candidate_lookup(uuid, text, uuid, integer)
  to service_role;

commit;
