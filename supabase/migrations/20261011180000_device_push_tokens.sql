-- Phone push tokens. The app schedules medicine and visit reminders on the device.
-- The website also sends an alert to a registered phone when it creates a notice.
-- Clients can read and write only their own tokens. The server uses the secret key to look them up.

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, token)
);

create index if not exists device_push_tokens_profile_idx on public.device_push_tokens (profile_id);

alter table public.device_push_tokens enable row level security;
alter table public.device_push_tokens force row level security;

drop policy if exists device_push_tokens_own on public.device_push_tokens;
create policy device_push_tokens_own on public.device_push_tokens
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.device_push_tokens to authenticated;
grant select, insert, update, delete on public.device_push_tokens to service_role;
