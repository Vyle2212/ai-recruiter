-- STAGING AUTH RLS v4 - AUTHORITATIVE PENDING-MANUAL-REVIEW ARTIFACT
-- VERSIONED, ONE-SHOT, STAGING-ONLY, NOT RERUNNABLE, NOT EXECUTED. PRODUCTION BLOCKED.
-- Default deny. Domain jobs, assignments, submissions, packs, reports, and main candidate access remain deferred.
begin;
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;
alter table public.user_invites enable row level security;
alter table public.user_invites force row level security;
alter table public.client_memberships enable row level security;
alter table public.client_memberships force row level security;
alter table public.candidate_accounts enable row level security;
alter table public.candidate_accounts force row level security;
alter table public.access_audit_logs enable row level security;
alter table public.access_audit_logs force row level security;
alter table public.staging_auth_bootstrap_provenance enable row level security;
alter table public.staging_auth_bootstrap_provenance force row level security;

revoke all on public.organizations,public.user_profiles,public.user_invites,public.client_memberships,public.candidate_accounts,public.access_audit_logs,public.staging_auth_bootstrap_provenance from anon;
revoke all on public.organizations,public.user_profiles,public.user_invites,public.client_memberships,public.candidate_accounts,public.access_audit_logs,public.staging_auth_bootstrap_provenance from authenticated;
grant select,insert,update on public.organizations,public.user_profiles,public.user_invites,public.client_memberships,public.candidate_accounts to authenticated;
grant select on public.access_audit_logs,public.staging_auth_bootstrap_provenance to authenticated;

create policy staging_auth_v4_admin_organizations_select
on public.organizations for select to authenticated using (public.current_user_is_admin());
create policy staging_auth_v4_admin_organizations_insert
on public.organizations for insert to authenticated with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_organizations_update
on public.organizations for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_user_profiles_select
on public.user_profiles for select to authenticated using (public.current_user_is_admin());
create policy staging_auth_v4_admin_user_profiles_insert
on public.user_profiles for insert to authenticated with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_user_profiles_update
on public.user_profiles for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_user_invites_select
on public.user_invites for select to authenticated using (public.current_user_is_admin());
create policy staging_auth_v4_admin_user_invites_insert
on public.user_invites for insert to authenticated with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_user_invites_update
on public.user_invites for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_client_memberships_select
on public.client_memberships for select to authenticated using (public.current_user_is_admin());
create policy staging_auth_v4_admin_client_memberships_insert
on public.client_memberships for insert to authenticated with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_client_memberships_update
on public.client_memberships for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_candidate_accounts_select
on public.candidate_accounts for select to authenticated using (public.current_user_is_admin());
create policy staging_auth_v4_admin_candidate_accounts_insert
on public.candidate_accounts for insert to authenticated with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_candidate_accounts_update
on public.candidate_accounts for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy staging_auth_v4_admin_access_audit_logs_select
on public.access_audit_logs for select to authenticated using (public.current_user_is_admin());
create policy staging_auth_v4_admin_bootstrap_provenance_select
on public.staging_auth_bootstrap_provenance for select to authenticated using (public.current_user_is_admin());

create policy staging_auth_v4_recruiter_manager_organizations_select
on public.organizations for select to authenticated using (public.current_user_role()='recruiter_manager' and id=public.current_user_organization_id());
create policy staging_auth_v4_recruiter_manager_user_profiles_self_select
on public.user_profiles for select to authenticated using (public.current_user_role()='recruiter_manager' and id=public.current_user_profile_id() and status='active');
create policy staging_auth_v4_recruiter_manager_user_profiles_self_update
on public.user_profiles for update to authenticated
using (public.current_user_role()='recruiter_manager' and id=public.current_user_profile_id() and status='active')
with check (public.current_user_role()='recruiter_manager' and id=public.current_user_profile_id() and status='active');

create policy staging_auth_v4_recruiter_organizations_select
on public.organizations for select to authenticated using (public.current_user_role()='recruiter' and id=public.current_user_organization_id() and organization_type='internal');
create policy staging_auth_v4_recruiter_user_profiles_select
on public.user_profiles for select to authenticated using (public.current_user_role()='recruiter' and id=public.current_user_profile_id() and status='active');
create policy staging_auth_v4_recruiter_user_profiles_update
on public.user_profiles for update to authenticated
using (public.current_user_role()='recruiter' and id=public.current_user_profile_id() and status='active')
with check (public.current_user_role()='recruiter' and id=public.current_user_profile_id() and status='active');

create policy staging_auth_v4_client_organizations_select
on public.organizations for select to authenticated using (public.current_user_role()='client' and id=public.current_user_organization_id() and organization_type='client');
create policy staging_auth_v4_client_user_profiles_select
on public.user_profiles for select to authenticated using (public.current_user_role()='client' and id=public.current_user_profile_id() and status='active');
create policy staging_auth_v4_client_user_profiles_update
on public.user_profiles for update to authenticated
using (public.current_user_role()='client' and id=public.current_user_profile_id() and status='active')
with check (public.current_user_role()='client' and id=public.current_user_profile_id() and status='active');
create policy staging_auth_v4_client_client_memberships_select
on public.client_memberships for select to authenticated using (
  public.current_user_role()='client' and status='active' and user_profile_id=public.current_user_profile_id()
  and organization_id=public.current_user_organization_id() and client_id=public.current_user_client_id()
);

create policy staging_auth_v4_candidate_user_profiles_select
on public.user_profiles for select to authenticated using (public.current_user_role()='candidate' and id=public.current_user_profile_id() and status='active');
create policy staging_auth_v4_candidate_user_profiles_update
on public.user_profiles for update to authenticated
using (public.current_user_role()='candidate' and id=public.current_user_profile_id() and status='active')
with check (public.current_user_role()='candidate' and id=public.current_user_profile_id() and status='active');
create policy staging_auth_v4_candidate_candidate_accounts_select
on public.candidate_accounts for select to authenticated using (
  public.current_user_role()='candidate' and status='active' and user_profile_id=public.current_user_profile_id()
  and candidate_id=public.current_user_candidate_id()
);
-- No provenance INSERT/UPDATE/DELETE policy. No DELETE policy anywhere. No guest or anon positive policy.
commit;
