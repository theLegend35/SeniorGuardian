create table public.care_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('patient', 'doctor', 'caregiver')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index care_messages_patient_idx on public.care_messages (patient_id, created_at);

create table public.clinician_threads (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null unique references public.doctors (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinician_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.clinician_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  proposed_action jsonb,
  action_status text check (action_status in ('pending', 'confirmed', 'dismissed')),
  source text check (source in ('ai', 'rules', 'safety')),
  created_at timestamptz not null default now()
);

create index clinician_messages_thread_idx on public.clinician_messages (thread_id, created_at);

alter table public.care_messages enable row level security;
alter table public.care_messages force row level security;
alter table public.clinician_threads enable row level security;
alter table public.clinician_threads force row level security;
alter table public.clinician_messages enable row level security;
alter table public.clinician_messages force row level security;

create policy care_messages_select on public.care_messages
  for select to authenticated
  using (
    patient_id = (select app_private.current_patient_id())
    or exists (
      select 1 from public.patient_doctors link
      where link.patient_id = care_messages.patient_id
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
    )
    or exists (
      select 1 from public.caregiver_permissions grant_row
      where grant_row.patient_id = care_messages.patient_id
        and grant_row.caregiver_id = (select id from public.caregivers where profile_id = (select auth.uid()))
        and grant_row.status = 'active'
    )
  );

create policy care_messages_insert on public.care_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      patient_id = (select app_private.current_patient_id())
      or exists (
        select 1 from public.patient_doctors link
        where link.patient_id = care_messages.patient_id
          and link.doctor_id = (select app_private.current_doctor_id())
          and link.status = 'active'
      )
      or exists (
        select 1 from public.caregiver_permissions grant_row
        where grant_row.patient_id = care_messages.patient_id
          and grant_row.caregiver_id = (select id from public.caregivers where profile_id = (select auth.uid()))
          and grant_row.status = 'active'
      )
    )
  );

create policy clinician_threads_all on public.clinician_threads
  for all to authenticated
  using (doctor_id = (select app_private.current_doctor_id()))
  with check (doctor_id = (select app_private.current_doctor_id()));

create policy clinician_messages_all on public.clinician_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.clinician_threads thread
      where thread.id = thread_id
        and thread.doctor_id = (select app_private.current_doctor_id())
    )
  )
  with check (
    exists (
      select 1 from public.clinician_threads thread
      where thread.id = thread_id
        and thread.doctor_id = (select app_private.current_doctor_id())
    )
  );

grant select, insert on public.care_messages to authenticated;
grant select, insert, update, delete on public.clinician_threads to authenticated;
grant select, insert, update, delete on public.clinician_messages to authenticated;
grant select, insert, update, delete on public.care_messages to service_role;
grant select, insert, update, delete on public.clinician_threads to service_role;
grant select, insert, update, delete on public.clinician_messages to service_role;
