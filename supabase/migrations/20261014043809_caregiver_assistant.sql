-- A caregiver's assistant thread. The phone and the site read it through the server.
-- A caregiver sees only their own thread.

create table public.caregiver_threads (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null unique references public.caregivers (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.caregiver_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.caregiver_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  source text check (source in ('ai', 'rules', 'safety')),
  created_at timestamptz not null default now()
);

create index caregiver_messages_thread_idx on public.caregiver_messages (thread_id, created_at);

alter table public.caregiver_threads enable row level security;
alter table public.caregiver_threads force row level security;
alter table public.caregiver_messages enable row level security;
alter table public.caregiver_messages force row level security;

create policy caregiver_threads_all on public.caregiver_threads
  for all to authenticated
  using (caregiver_id = (select id from public.caregivers where profile_id = (select auth.uid())))
  with check (caregiver_id = (select id from public.caregivers where profile_id = (select auth.uid())));

create policy caregiver_messages_all on public.caregiver_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.caregiver_threads thread
      where thread.id = thread_id
        and thread.caregiver_id = (select id from public.caregivers where profile_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.caregiver_threads thread
      where thread.id = thread_id
        and thread.caregiver_id = (select id from public.caregivers where profile_id = (select auth.uid()))
    )
  );

grant select, insert, update, delete on public.caregiver_threads to authenticated, service_role;
grant select, insert, update, delete on public.caregiver_messages to authenticated, service_role;
