-- Manual, supervised schema preparation before the first bulk CV upload.
-- Source filenames can contain personal data. Only the server service role
-- may read or change these rows; no browser-side table access is permitted.
begin;

create table if not exists public.candidate_upload_reviews (
  id uuid primary key default gen_random_uuid(),
  source_file text not null unique,
  original_filename text not null,
  actor_user_id uuid not null,
  reason_codes text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.candidate_upload_reviews enable row level security;
alter table public.candidate_upload_reviews force row level security;
revoke all on public.candidate_upload_reviews from public, anon, authenticated;
grant select, insert, update on public.candidate_upload_reviews to service_role;

create index if not exists candidate_upload_reviews_status_created_idx
  on public.candidate_upload_reviews(status, created_at);

commit;
