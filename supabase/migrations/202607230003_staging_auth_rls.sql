-- STAGING AUTH RLS v1 � AUTHORITATIVE REVIEW ARTIFACT
-- REVIEW ONLY. NOT EXECUTED. STAGING TARGET ONLY. PRODUCTION BLOCKED.
-- Default deny: authenticated receives only listed grants and positive policies; guest/anon receives none.
-- Assignment-based recruiter access, domain candidate access, jobs, submissions, packs, and reports are deferred.

alter table public.organizations enable row level security; alter table public.organizations force row level security;
alter table public.user_profiles enable row level security; alter table public.user_profiles force row level security;
alter table public.user_invites enable row level security; alter table public.user_invites force row level security;
alter table public.client_memberships enable row level security; alter table public.client_memberships force row level security;
alter table public.candidate_accounts enable row level security; alter table public.candidate_accounts force row level security;
alter table public.access_audit_logs enable row level security; alter table public.access_audit_logs force row level security;

revoke all on public.organizations, public.user_profiles, public.user_invites, public.client_memberships, public.candidate_accounts, public.access_audit_logs from anon;
revoke all on public.organizations, public.user_profiles, public.user_invites, public.client_memberships, public.candidate_accounts, public.access_audit_logs from authenticated;
grant select, insert, update on public.organizations, public.user_profiles, public.user_invites, public.client_memberships, public.candidate_accounts to authenticated;
grant select on public.access_audit_logs to authenticated;

-- ADMIN: active-profile helpers only. DELETE remains blocked on every table.
create policy admin_organizations_select on public.organizations for select to authenticated using (public.current_user_is_admin());
create policy admin_organizations_insert on public.organizations for insert to authenticated with check (public.current_user_is_admin());
create policy admin_organizations_update on public.organizations for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_user_profiles_select on public.user_profiles for select to authenticated using (public.current_user_is_admin());
create policy admin_user_profiles_insert on public.user_profiles for insert to authenticated with check (public.current_user_is_admin());
create policy admin_user_profiles_update on public.user_profiles for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_user_invites_select on public.user_invites for select to authenticated using (public.current_user_is_admin());
create policy admin_user_invites_insert on public.user_invites for insert to authenticated with check (public.current_user_is_admin());
create policy admin_user_invites_update on public.user_invites for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_client_memberships_select on public.client_memberships for select to authenticated using (public.current_user_is_admin());
create policy admin_client_memberships_insert on public.client_memberships for insert to authenticated with check (public.current_user_is_admin());
create policy admin_client_memberships_update on public.client_memberships for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_candidate_accounts_select on public.candidate_accounts for select to authenticated using (public.current_user_is_admin());
create policy admin_candidate_accounts_insert on public.candidate_accounts for insert to authenticated with check (public.current_user_is_admin());
create policy admin_candidate_accounts_update on public.candidate_accounts for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_access_audit_logs_select on public.access_audit_logs for select to authenticated using (public.current_user_is_admin());

-- RECRUITER MANAGER: organization-scoped reads only; no audit-log access.
create policy recruiter_manager_organizations_select on public.organizations for select to authenticated using (
  public.current_user_role() = 'recruiter_manager' and id = public.current_user_organization_id()
);
create policy recruiter_manager_user_profiles_select on public.user_profiles for select to authenticated using (
  public.current_user_role() = 'recruiter_manager' and status = 'active' and organization_id = public.current_user_organization_id()
);

-- RECRUITER: self profile and own internal organization only. Assignment policies are deferred.
create policy recruiter_organizations_select on public.organizations for select to authenticated using (
  public.current_user_role() = 'recruiter' and id = public.current_user_organization_id() and organization_type = 'internal'
);
create policy recruiter_user_profiles_select on public.user_profiles for select to authenticated using (
  public.current_user_role() = 'recruiter' and id = public.current_user_profile_id() and status = 'active'
);
create policy recruiter_user_profiles_update on public.user_profiles for update to authenticated using (
  public.current_user_role() = 'recruiter' and id = public.current_user_profile_id() and status = 'active'
) with check (
  public.current_user_role() = 'recruiter' and id = public.current_user_profile_id() and status = 'active'
);

-- CLIENT: own active profile, exact membership, and own client organization only.
create policy client_organizations_select on public.organizations for select to authenticated using (
  public.current_user_role() = 'client' and id = public.current_user_organization_id() and organization_type = 'client'
);
create policy client_user_profiles_select on public.user_profiles for select to authenticated using (
  public.current_user_role() = 'client' and id = public.current_user_profile_id() and status = 'active'
);
create policy client_user_profiles_update on public.user_profiles for update to authenticated using (
  public.current_user_role() = 'client' and id = public.current_user_profile_id() and status = 'active'
) with check (
  public.current_user_role() = 'client' and id = public.current_user_profile_id() and status = 'active'
);
create policy client_client_memberships_select on public.client_memberships for select to authenticated using (
  public.current_user_role() = 'client' and status = 'active' and
  user_profile_id = public.current_user_profile_id() and
  organization_id = public.current_user_organization_id() and
  client_id = public.current_user_client_id()
);

-- CANDIDATE: own active profile and exact synthetic staging ownership mapping only.
create policy candidate_user_profiles_select on public.user_profiles for select to authenticated using (
  public.current_user_role() = 'candidate' and id = public.current_user_profile_id() and status = 'active'
);
create policy candidate_user_profiles_update on public.user_profiles for update to authenticated using (
  public.current_user_role() = 'candidate' and id = public.current_user_profile_id() and status = 'active'
) with check (
  public.current_user_role() = 'candidate' and id = public.current_user_profile_id() and status = 'active'
);
create policy candidate_candidate_accounts_select on public.candidate_accounts for select to authenticated using (
  public.current_user_role() = 'candidate' and status = 'active' and
  user_profile_id = public.current_user_profile_id() and candidate_id = public.current_user_candidate_id()
);

-- No guest/anon policies. No audit-log INSERT/UPDATE/DELETE policies.
