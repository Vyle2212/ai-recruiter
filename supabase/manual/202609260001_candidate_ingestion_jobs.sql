-- Manual, reviewed-run only. Creates a durable, service-role-only job ledger.
-- Applying this schema alone does not switch uploads to asynchronous parsing.
begin;

create table if not exists public.candidate_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  source_file text not null,
  original_filename text not null,
  content_sha256 text not null,
  parser_revision text not null,
  byte_size integer not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  available_at timestamptz not null default now(),
  result_candidate_id uuid,
  outcome_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_ingestion_jobs_digest_check
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint candidate_ingestion_jobs_revision_check
    check (length(parser_revision) between 1 and 80 and parser_revision ~ '^[a-zA-Z0-9._-]+$'),
  constraint candidate_ingestion_jobs_size_check
    check (byte_size between 1 and 20971520),
  constraint candidate_ingestion_jobs_source_check
    check (source_file ~* '^candidate-original-cvs/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](pdf|docx|doc|rtf|txt)$'),
  constraint candidate_ingestion_jobs_status_check
    check (status in ('queued', 'running', 'completed', 'review', 'failed')),
  constraint candidate_ingestion_jobs_attempts_check
    check (attempts between 0 and 5),
  constraint candidate_ingestion_jobs_lease_check
    check ((status = 'running') = (lease_token is not null and lease_expires_at is not null)),
  constraint candidate_ingestion_jobs_filename_check
    check (length(original_filename) between 1 and 255),
  constraint candidate_ingestion_jobs_actor_digest_unique
    unique (actor_user_id, content_sha256, parser_revision),
  constraint candidate_ingestion_jobs_source_revision_unique
    unique (source_file, parser_revision)
);

create index if not exists candidate_ingestion_jobs_ready_idx
  on public.candidate_ingestion_jobs (available_at, created_at, id)
  where status = 'queued';
create index if not exists candidate_ingestion_jobs_expired_idx
  on public.candidate_ingestion_jobs (lease_expires_at, id)
  where status = 'running';
-- The admin browser enqueues old CV versions before new ones. Workers may
-- process different actors concurrently, but only the oldest unfinished job
-- for one actor may be claimed at a time.
create index if not exists candidate_ingestion_jobs_actor_order_idx
  on public.candidate_ingestion_jobs (actor_user_id, created_at, id)
  where status in ('queued', 'running');

alter table public.candidate_ingestion_jobs enable row level security;
alter table public.candidate_ingestion_jobs force row level security;
revoke all on public.candidate_ingestion_jobs from public, anon, authenticated;
grant select, insert, update on public.candidate_ingestion_jobs to service_role;

-- The source bytes and digest must already be verified before insertion.
-- Conflict on actor + digest + parser revision returns the original job.
-- A new parser revision may deliberately reprocess the same immutable CV.
create or replace function public.enqueue_candidate_ingestion_job(
  p_actor_user_id uuid,
  p_source_file text,
  p_original_filename text,
  p_content_sha256 text,
  p_parser_revision text,
  p_byte_size integer
) returns public.candidate_ingestion_jobs
language plpgsql security invoker set search_path = '' as $function$
declare v_job public.candidate_ingestion_jobs;
begin
  insert into public.candidate_ingestion_jobs (
    actor_user_id, source_file, original_filename, content_sha256,
    parser_revision, byte_size
  ) values (
    p_actor_user_id, p_source_file, p_original_filename, p_content_sha256,
    p_parser_revision, p_byte_size
  )
  on conflict (actor_user_id, content_sha256, parser_revision) do update
    set updated_at = public.candidate_ingestion_jobs.updated_at
  returning * into v_job;
  return v_job;
end
$function$;

-- Concurrent workers take disjoint rows. A crashed worker's lease can expire;
-- the worker must check source_file readback before attempting a second save.
create or replace function public.claim_candidate_ingestion_jobs(
  p_limit integer default 10
) returns setof public.candidate_ingestion_jobs
language plpgsql security invoker set search_path = '' as $function$
begin
  if p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'candidate_ingestion_claim_limit_invalid';
  end if;
  update public.candidate_ingestion_jobs
  set status = 'failed', lease_token = null, lease_expires_at = null,
      outcome_code = 'retry_exhausted', updated_at = now()
  where (status = 'running' and lease_expires_at < now() and attempts >= 5)
     or (status = 'queued' and attempts >= 5);

  return query
  with next_jobs as (
    select candidate_job.id from public.candidate_ingestion_jobs candidate_job
    where ((candidate_job.status = 'queued' and candidate_job.available_at <= now()
            and candidate_job.attempts < 5)
       or (candidate_job.status = 'running' and candidate_job.lease_expires_at < now()
            and candidate_job.attempts < 5))
      and not exists (
        select 1 from public.candidate_ingestion_jobs earlier
        where earlier.actor_user_id = candidate_job.actor_user_id
          and (earlier.created_at, earlier.id) <
              (candidate_job.created_at, candidate_job.id)
          and earlier.status in ('queued', 'running')
      )
      and not exists (
        select 1 from public.candidate_ingestion_jobs active_job
        where active_job.actor_user_id = candidate_job.actor_user_id
          and active_job.id <> candidate_job.id
          and active_job.status = 'running'
          and active_job.lease_expires_at > now()
      )
    order by candidate_job.created_at, candidate_job.id
    for update of candidate_job skip locked
    limit p_limit
  )
  update public.candidate_ingestion_jobs as jobs
  set status = 'running', attempts = jobs.attempts + 1,
      lease_token = gen_random_uuid(), lease_expires_at = now() + interval '10 minutes',
      updated_at = now()
  from next_jobs
  where jobs.id = next_jobs.id
  returning jobs.*;
end
$function$;

-- The active worker must claim only jobs written for its exact parser build.
-- The older one-argument RPC is retained for migration compatibility but
-- loses service-role EXECUTE below; it must never be used by a worker.
create or replace function public.claim_candidate_ingestion_jobs_for_revision(
  p_parser_revision text,
  p_limit integer default 10
) returns setof public.candidate_ingestion_jobs
language plpgsql security invoker set search_path = '' as $function$
begin
  if p_parser_revision is null or length(p_parser_revision) not between 1 and 80
     or p_parser_revision !~ '^[a-zA-Z0-9._-]+$'
     or p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'candidate_ingestion_claim_input_invalid';
  end if;
  update public.candidate_ingestion_jobs
  set status = 'failed', lease_token = null, lease_expires_at = null,
      outcome_code = 'retry_exhausted', updated_at = now()
  where (status = 'running' and lease_expires_at < now() and attempts >= 5)
     or (status = 'queued' and attempts >= 5);

  return query
  with next_jobs as (
    select candidate_job.id from public.candidate_ingestion_jobs candidate_job
    where candidate_job.parser_revision = p_parser_revision
      and ((candidate_job.status = 'queued' and candidate_job.available_at <= now()
            and candidate_job.attempts < 5)
       or (candidate_job.status = 'running' and candidate_job.lease_expires_at < now()
            and candidate_job.attempts < 5))
      and not exists (
        select 1 from public.candidate_ingestion_jobs earlier
        where earlier.actor_user_id = candidate_job.actor_user_id
          and (earlier.created_at, earlier.id) <
              (candidate_job.created_at, candidate_job.id)
          and earlier.status in ('queued', 'running')
      )
      and not exists (
        select 1 from public.candidate_ingestion_jobs active_job
        where active_job.actor_user_id = candidate_job.actor_user_id
          and active_job.id <> candidate_job.id
          and active_job.status = 'running'
          and active_job.lease_expires_at > now()
      )
    order by candidate_job.created_at, candidate_job.id
    for update of candidate_job skip locked
    limit p_limit
  )
  update public.candidate_ingestion_jobs as jobs
  set status = 'running', attempts = jobs.attempts + 1,
      lease_token = gen_random_uuid(), lease_expires_at = now() + interval '10 minutes',
      updated_at = now()
  from next_jobs
  where jobs.id = next_jobs.id
  returning jobs.*;
end
$function$;

-- A slow parser can extend only its own live lease. If the worker crashes,
-- the token expires and another worker may claim the job.
create or replace function public.renew_candidate_ingestion_job(
  p_job_id uuid,
  p_lease_token uuid
) returns boolean
language plpgsql security invoker set search_path = '' as $function$
declare v_changed integer;
begin
  update public.candidate_ingestion_jobs
  set lease_expires_at = now() + interval '10 minutes', updated_at = now()
  where id = p_job_id and status = 'running'
    and lease_token = p_lease_token and lease_expires_at > now();
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end
$function$;

-- Only the holder of the current lease may acknowledge it. Error codes are
-- fixed operational categories; never persist raw CV text or parser messages.
create or replace function public.finish_candidate_ingestion_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_status text,
  p_result_candidate_id uuid default null,
  p_outcome_code text default null
) returns boolean
language plpgsql security invoker set search_path = '' as $function$
declare v_changed integer;
begin
  if p_status is null or p_status not in ('completed', 'review', 'queued', 'failed')
     or (p_status = 'completed' and p_result_candidate_id is null)
     or p_outcome_code is not null and p_outcome_code not in (
       'created', 'updated', 'already_processed', 'incomplete_review',
       'identity_review', 'source_review', 'non_sap_rejected',
       'processing_failure', 'retry_exhausted'
     ) then
    raise exception 'candidate_ingestion_outcome_invalid';
  end if;
  update public.candidate_ingestion_jobs
  set status = case when p_status = 'queued' and attempts >= 5
                    then 'failed' else p_status end,
      outcome_code = case when p_status = 'queued' and attempts >= 5
                          then 'retry_exhausted' else p_outcome_code end,
      result_candidate_id = p_result_candidate_id,
      lease_token = null, lease_expires_at = null,
      available_at = case when p_status = 'queued'
        then now() + make_interval(secs => least(3600, power(2, attempts)::integer * 30))
        else available_at end,
      updated_at = now()
  where id = p_job_id and status = 'running'
    and lease_token = p_lease_token and lease_expires_at > now();
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end
$function$;

revoke all on function public.enqueue_candidate_ingestion_job(uuid,text,text,text,text,integer)
  from public, anon, authenticated;
revoke all on function public.claim_candidate_ingestion_jobs(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_candidate_ingestion_jobs_for_revision(text,integer)
  from public, anon, authenticated;
revoke all on function public.renew_candidate_ingestion_job(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.finish_candidate_ingestion_job(uuid,uuid,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.enqueue_candidate_ingestion_job(uuid,text,text,text,text,integer)
  to service_role;
grant execute on function public.claim_candidate_ingestion_jobs_for_revision(text,integer)
  to service_role;
grant execute on function public.renew_candidate_ingestion_job(uuid,uuid)
  to service_role;
grant execute on function public.finish_candidate_ingestion_job(uuid,uuid,text,uuid,text)
  to service_role;

commit;
