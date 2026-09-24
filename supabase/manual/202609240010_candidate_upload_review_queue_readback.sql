begin transaction read only;

do $verify$
declare target oid := to_regclass('public.candidate_upload_reviews');
begin
  if target is null or not exists (
    select 1 from pg_class
    where oid = target and relrowsecurity and relforcerowsecurity
  ) then
    raise exception 'Candidate upload review queue RLS is not ready';
  end if;
  if has_table_privilege('anon', target, 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', target, 'SELECT, INSERT, UPDATE, DELETE')
     or not has_table_privilege('service_role', target, 'SELECT')
     or not has_table_privilege('service_role', target, 'INSERT') then
    raise exception 'Candidate upload review queue grants are not safe';
  end if;
end
$verify$;

select
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as anon_has_privilege,
  has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as authenticated_has_privilege,
  (has_table_privilege('service_role', c.oid, 'SELECT') and
   has_table_privilege('service_role', c.oid, 'INSERT')) as service_can_read_write
from pg_class c
where c.oid = to_regclass('public.candidate_upload_reviews');

select count(*) as pending_review_count
from public.candidate_upload_reviews
where status = 'pending';

commit;
