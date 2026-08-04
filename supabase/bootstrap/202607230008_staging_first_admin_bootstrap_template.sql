-- STAGING FIRST ADMIN BOOTSTRAP TEMPLATE v2 - MANUAL TEMPLATE ONLY - NOT EXECUTED
-- STAGING ONLY. PRODUCTION USE IS FORBIDDEN. This is not a migration and creates no Auth user.
-- Replace every placeholder only after manually creating and confirming exactly one dedicated staging Auth user.
-- REQUIRED CHECKLIST: staging target; production not selected; Auth user created and identity confirmed;
-- reviewed organization; backup; fingerprint; explicit owner approval; production remains blocked.
-- DEFAULT APPROVAL: NO. Never use browser/query-string role input.

begin;

do $$
declare
  v_auth_user_id_text constant text := '__REPLACE_WITH_CONFIRMED_STAGING_AUTH_USER_UUID__';
  v_organization_id_text constant text := '__REPLACE_WITH_REVIEWED_STAGING_ORGANIZATION_UUID__';
  v_profile_email constant text := '__REPLACE_WITH_CONFIRMED_STAGING_EMAIL__';
  v_full_name constant text := '__REPLACE_WITH_REVIEWED_DISPLAY_NAME__';
  v_auth_user_id uuid;
  v_organization_id uuid;
begin
  if v_auth_user_id_text like '__REPLACE_%' or v_organization_id_text like '__REPLACE_%'
     or v_profile_email like '__REPLACE_%' or v_full_name like '__REPLACE_%' then
    raise exception using errcode = 'P0001', message = 'staging_admin_bootstrap_placeholder_not_replaced';
  end if;
  v_auth_user_id := v_auth_user_id_text::uuid;
  v_organization_id := v_organization_id_text::uuid;

  if exists (select 1 from public.user_profiles where role = 'admin' and status = 'active') then
    raise exception using errcode = 'P0001', message = 'staging_admin_bootstrap_active_admin_already_exists';
  end if;
  if exists (select 1 from public.user_profiles where auth_user_id = v_auth_user_id) then
    raise exception using errcode = 'P0001', message = 'staging_admin_bootstrap_profile_already_exists';
  end if;
  if not exists (
    select 1 from auth.users where id = v_auth_user_id and lower(email) = lower(v_profile_email)
  ) then
    raise exception using errcode = 'P0001', message = 'staging_admin_bootstrap_auth_identity_not_confirmed';
  end if;
  if not exists (
    select 1 from public.organizations where id = v_organization_id and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'staging_admin_bootstrap_organization_not_confirmed';
  end if;

  insert into public.user_profiles (auth_user_id,email,full_name,role,status,organization_id,client_id,candidate_id)
  values (v_auth_user_id,btrim(v_profile_email),btrim(v_full_name),'admin','active',v_organization_id,null,null);
end;
$$;

commit;

-- CORRESPONDING BOOTSTRAP ROLLBACK TEMPLATE - COPY AND RUN SEPARATELY ONLY AFTER APPROVAL:
-- begin;
-- delete from public.user_profiles
-- where auth_user_id = '__REPLACE_WITH_SAME_CONFIRMED_STAGING_AUTH_USER_UUID__'::uuid
--   and role = 'admin' and status = 'active'
--   and organization_id = '__REPLACE_WITH_SAME_REVIEWED_STAGING_ORGANIZATION_UUID__'::uuid
--   and client_id is null and candidate_id is null;
-- commit;
-- Verify exactly one row is targeted before rollback. This never touches candidate-domain records.