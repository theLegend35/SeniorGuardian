alter table public.caregiver_permissions
  add column if not exists view_readings boolean not null default false;

create table if not exists public.device_connections (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  provider text not null check (provider in ('fitbit', 'google_health', 'watch', 'ring')),
  label text not null,
  status text not null default 'connected' check (status in ('connected', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.device_connection_secrets (
  connection_id uuid primary key references public.device_connections (id) on delete cascade,
  access_token text not null,
  refresh_token text not null default '',
  expires_at timestamptz not null
);

create table if not exists public.reading_ranges (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  metric text not null check (metric in ('heart_rate', 'sleep_hours', 'steps', 'blood_oxygen')),
  low numeric not null,
  high numeric not null,
  unique (patient_id, metric)
);

create table if not exists public.device_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  connection_id uuid not null references public.device_connections (id) on delete cascade,
  metric text not null check (metric in ('heart_rate', 'sleep_hours', 'steps', 'blood_oxygen')),
  value numeric not null,
  unit text not null,
  recorded_at timestamptz not null,
  status text not null check (status in ('inside', 'outside', 'no_range')),
  created_at timestamptz not null default now()
);

create index if not exists device_readings_patient_idx on public.device_readings (patient_id, recorded_at desc);

create or replace function app_private.can_view_patient(target uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target = (select app_private.current_patient_id())
    or exists (
      select 1
      from public.patient_doctors link
      where link.patient_id = target
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
        and perm <> 'reminders'
    )
    or exists (
      select 1
      from public.caregiver_permissions grant_row
      where grant_row.patient_id = target
        and grant_row.caregiver_id = (
          select id from public.caregivers where profile_id = (select auth.uid())
        )
        and grant_row.status = 'active'
        and (
          (perm = 'overview' and (grant_row.view_medications or grant_row.view_appointments or grant_row.view_timeline or grant_row.view_concerns or grant_row.view_readings))
          or (perm = 'medications' and grant_row.view_medications)
          or (perm = 'appointments' and grant_row.view_appointments)
          or (perm in ('timeline', 'documents', 'notes') and grant_row.view_timeline)
          or (perm = 'concerns' and grant_row.view_concerns)
          or (perm = 'reminders' and grant_row.manage_reminders)
          or (perm = 'readings' and grant_row.view_readings)
          or (perm = 'files' and (grant_row.view_timeline or grant_row.view_concerns or grant_row.view_medications))
        )
    )
$$;

alter table public.device_connections enable row level security;
alter table public.device_connection_secrets enable row level security;
alter table public.reading_ranges enable row level security;
alter table public.device_readings enable row level security;

alter table public.device_connections force row level security;
alter table public.device_connection_secrets force row level security;
alter table public.reading_ranges force row level security;
alter table public.device_readings force row level security;

create policy device_connections_select on public.device_connections
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'readings')));

create policy device_connections_write on public.device_connections
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy reading_ranges_select on public.reading_ranges
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'readings')));

create policy reading_ranges_write on public.reading_ranges
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy device_readings_select on public.device_readings
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'readings')));

create policy device_secrets_deny on public.device_connection_secrets
  for all to authenticated
  using (false)
  with check (false);

create policy device_readings_write on public.device_readings
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

grant select, insert, update, delete on public.device_connections to authenticated, service_role;
grant select, insert, update, delete on public.reading_ranges to authenticated, service_role;
grant select, insert, update, delete on public.device_readings to authenticated, service_role;
grant select, insert, update, delete on public.device_connection_secrets to service_role;
