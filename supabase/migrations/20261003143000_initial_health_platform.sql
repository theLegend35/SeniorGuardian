-- Senior Help AI
-- Credential accounts live in auth.users. public.profiles is the application user record.
-- Role comes from app_metadata, never from editable user_metadata.
-- Clinical rows are visible only to the patient, an explicitly authorized clinician,
-- or a caregiver with that specific permission.

create schema if not exists app_private;

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function app_private.touch_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('patient', 'doctor', 'caregiver')),
  full_name text not null default '',
  phone text not null default '',
  text_scale text not null default 'default' check (text_scale in ('default', 'large', 'largest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  date_of_birth date,
  address text not null default '',
  emergency_contact text not null default '',
  blood_type text not null default '',
  allergies text not null default '',
  conditions text not null default '',
  fictional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  specialty text not null default '',
  clinic text not null default '',
  fictional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.caregivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  relationship text not null default '',
  fictional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patient_doctors (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  authorized_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (patient_id, doctor_id)
);

create table public.caregiver_permissions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  caregiver_id uuid not null references public.caregivers (id) on delete cascade,
  view_medications boolean not null default false,
  view_appointments boolean not null default false,
  view_timeline boolean not null default false,
  view_concerns boolean not null default false,
  manage_reminders boolean not null default false,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (patient_id, caregiver_id)
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  name text not null,
  instructions text not null,
  frequency text not null,
  times text[] not null default '{}',
  start_date date,
  end_date date,
  prescribing_provider text not null default '',
  notes text not null default '',
  prescription_id uuid,
  status text not null default 'active' check (status in ('active', 'archived')),
  reminder_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medication_events (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  kind text not null check (kind in ('taken', 'missed', 'reminder_set', 'added', 'updated', 'archived')),
  scheduled_for text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  medication_id uuid references public.medications (id) on delete set null,
  title text not null,
  source_text text not null,
  file_id uuid,
  ai_explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.medications
  add constraint medications_prescription_fk
  foreign key (prescription_id) references public.prescriptions (id) on delete set null;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  provider text not null,
  specialty text not null default '',
  starts_at timestamptz not null,
  location text not null default '',
  notes text not null default '',
  questions text[] not null default '{}',
  reminder_enabled boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.health_concerns (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  description text not null,
  image_file_id uuid,
  analysis jsonb,
  shared_with_care_team boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.health_timeline (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  kind text not null check (kind in (
    'concern', 'image', 'medication_change', 'medication_activity',
    'appointment', 'doctor_note', 'patient_note', 'document', 'ai_summary'
  )),
  title text not null,
  summary text not null default '',
  source_label text not null default '',
  ref_table text not null,
  ref_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.health_files (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  bucket text not null check (bucket in ('concerns', 'prescriptions', 'documents')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  bytes integer not null,
  created_at timestamptz not null default now()
);

create table public.health_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('prescription', 'record', 'lab', 'other')),
  file_id uuid references public.health_files (id) on delete set null,
  source_text text not null default '',
  ai_explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctor_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients (id) on delete cascade,
  title text not null default 'Health assistant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  proposed_action jsonb,
  action_status text check (action_status in ('pending', 'confirmed', 'dismissed')),
  medication_ids uuid[] not null default '{}',
  source text check (source in ('ai', 'rules', 'safety')),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('medication', 'appointment', 'doctor_message', 'caregiver', 'app')),
  title text not null,
  body text not null,
  href text,
  read boolean not null default false,
  alarm_key text,
  created_at timestamptz not null default now()
);

create index medications_patient_idx on public.medications (patient_id);
create index medication_events_patient_idx on public.medication_events (patient_id, medication_id);
create index prescriptions_patient_idx on public.prescriptions (patient_id);
create index appointments_patient_idx on public.appointments (patient_id, starts_at);
create index concerns_patient_idx on public.health_concerns (patient_id, created_at desc);
create index timeline_patient_idx on public.health_timeline (patient_id, created_at desc);
create index documents_patient_idx on public.health_documents (patient_id);
create index files_patient_idx on public.health_files (patient_id);
create index notes_patient_idx on public.doctor_notes (patient_id, created_at desc);
create index patient_doctors_doctor_idx on public.patient_doctors (doctor_id, status);
create index caregiver_permissions_caregiver_idx on public.caregiver_permissions (caregiver_id, status);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);
create unique index notifications_alarm_key_idx on public.notifications (profile_id, alarm_key) where alarm_key is not null;
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create or replace function app_private.current_patient_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.patients where profile_id = (select auth.uid())
$$;

create or replace function app_private.current_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.doctors where profile_id = (select auth.uid())
$$;

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
          (perm = 'overview' and (grant_row.view_medications or grant_row.view_appointments or grant_row.view_timeline or grant_row.view_concerns))
          or (perm = 'medications' and grant_row.view_medications)
          or (perm = 'appointments' and grant_row.view_appointments)
          or (perm in ('timeline', 'documents', 'notes') and grant_row.view_timeline)
          or (perm = 'concerns' and grant_row.view_concerns)
          or (perm = 'reminders' and grant_row.manage_reminders)
          or (perm = 'files' and (grant_row.view_timeline or grant_row.view_concerns or grant_row.view_medications))
        )
    )
$$;

create or replace function app_private.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target = (select auth.uid())
    or exists (
      select 1
      from public.patients patient
      join public.patient_doctors link on link.patient_id = patient.id and link.status = 'active'
      join public.doctors doctor on doctor.id = link.doctor_id
      where patient.profile_id = target and doctor.profile_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.doctors doctor
      join public.patient_doctors link on link.doctor_id = doctor.id and link.status = 'active'
      join public.patients patient on patient.id = link.patient_id
      where doctor.profile_id = target and patient.profile_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.patients patient
      join public.caregiver_permissions grant_row on grant_row.patient_id = patient.id and grant_row.status = 'active'
      join public.caregivers caregiver on caregiver.id = grant_row.caregiver_id
      where patient.profile_id = target and caregiver.profile_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.caregivers caregiver
      join public.caregiver_permissions grant_row on grant_row.caregiver_id = caregiver.id and grant_row.status = 'active'
      join public.patients patient on patient.id = grant_row.patient_id
      where caregiver.profile_id = target and patient.profile_id = (select auth.uid())
    )
$$;

create or replace function app_private.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Signed-in users cannot change a role. The server may set it once while
  -- creating the account, because the auth row is inserted before app_metadata exists.
  if tg_op = 'UPDATE' and new.role is distinct from old.role and (select auth.uid()) is not null then
    raise exception 'role cannot be changed';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function app_private.protect_profile() from public, anon, authenticated;

-- A caregiver who can set reminders may update a medication row, but only the
-- reminder schedule. Prescription text stays with the patient.
create or replace function app_private.protect_prescription_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (select app_private.current_patient_id()) is distinct from old.patient_id
     and (
       new.name is distinct from old.name
       or new.instructions is distinct from old.instructions
       or new.frequency is distinct from old.frequency
       or new.start_date is distinct from old.start_date
       or new.end_date is distinct from old.end_date
       or new.prescribing_provider is distinct from old.prescribing_provider
       or new.notes is distinct from old.notes
       or new.prescription_id is distinct from old.prescription_id
       or new.status is distinct from old.status
       or new.patient_id is distinct from old.patient_id
     )
  then
    raise exception 'Only reminder times can be changed by a caregiver.';
  end if;
  return new;
end;
$$;

revoke all on function app_private.protect_prescription_text() from public, anon, authenticated;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned text;
begin
  assigned := coalesce(new.raw_app_meta_data ->> 'role', 'patient');
  if assigned not in ('patient', 'doctor', 'caregiver') then
    assigned := 'patient';
  end if;
  insert into public.profiles (id, email, role, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    assigned,
    coalesce(new.raw_app_meta_data ->> 'full_name', ''),
    coalesce(new.raw_app_meta_data ->> 'phone', '')
  );
  if assigned = 'patient' then
    insert into public.patients (profile_id, fictional)
    values (new.id, coalesce((new.raw_app_meta_data ->> 'fictional')::boolean, false));
  elsif assigned = 'doctor' then
    insert into public.doctors (profile_id, specialty, clinic, fictional)
    values (
      new.id,
      coalesce(new.raw_app_meta_data ->> 'specialty', ''),
      coalesce(new.raw_app_meta_data ->> 'clinic', ''),
      coalesce((new.raw_app_meta_data ->> 'fictional')::boolean, false)
    );
  else
    insert into public.caregivers (profile_id, relationship, fictional)
    values (
      new.id,
      coalesce(new.raw_app_meta_data ->> 'relationship', ''),
      coalesce((new.raw_app_meta_data ->> 'fictional')::boolean, false)
    );
  end if;
  return new;
end;
$$;

revoke all on function app_private.handle_new_user() from public, anon, authenticated;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function app_private.protect_profile();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'patients', 'doctors', 'caregivers', 'caregiver_permissions', 'medications',
    'prescriptions', 'appointments', 'health_concerns', 'health_documents', 'doctor_notes', 'ai_conversations'
  ]
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function app_private.touch_updated_at()', tbl, tbl);
  end loop;
end;
$$;

create trigger medications_protect_prescription
  before update on public.medications
  for each row execute function app_private.protect_prescription_text();

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.caregivers enable row level security;
alter table public.patient_doctors enable row level security;
alter table public.caregiver_permissions enable row level security;
alter table public.medications enable row level security;
alter table public.medication_events enable row level security;
alter table public.prescriptions enable row level security;
alter table public.appointments enable row level security;
alter table public.health_concerns enable row level security;
alter table public.health_timeline enable row level security;
alter table public.health_files enable row level security;
alter table public.health_documents enable row level security;
alter table public.doctor_notes enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.notifications enable row level security;

alter table public.profiles force row level security;
alter table public.patients force row level security;
alter table public.doctors force row level security;
alter table public.caregivers force row level security;
alter table public.patient_doctors force row level security;
alter table public.caregiver_permissions force row level security;
alter table public.medications force row level security;
alter table public.medication_events force row level security;
alter table public.prescriptions force row level security;
alter table public.appointments force row level security;
alter table public.health_concerns force row level security;
alter table public.health_timeline force row level security;
alter table public.health_files force row level security;
alter table public.health_documents force row level security;
alter table public.doctor_notes force row level security;
alter table public.ai_conversations force row level security;
alter table public.ai_messages force row level security;
alter table public.notifications force row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using ((select app_private.can_view_profile(id)));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy patients_select on public.patients
  for select to authenticated
  using ((select app_private.can_view_patient(id, 'overview')) or profile_id = (select auth.uid()));

create policy patients_update on public.patients
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy doctors_select on public.doctors
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select app_private.can_view_profile(profile_id))
  );

create policy caregivers_select on public.caregivers
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select app_private.can_view_profile(profile_id))
  );

create policy links_select on public.patient_doctors
  for select to authenticated
  using (
    patient_id = (select app_private.current_patient_id())
    or doctor_id = (select app_private.current_doctor_id())
  );

create policy links_write on public.patient_doctors
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy grants_select on public.caregiver_permissions
  for select to authenticated
  using (
    patient_id = (select app_private.current_patient_id())
    or caregiver_id = (select id from public.caregivers where profile_id = (select auth.uid()))
  );

create policy grants_write on public.caregiver_permissions
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy medications_select on public.medications
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'medications')));

create policy medications_write on public.medications
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy medication_events_select on public.medication_events
  for select to authenticated
  using (
    (select app_private.can_view_patient(patient_id, 'medications'))
    or (select app_private.can_view_patient(patient_id, 'reminders'))
  );

create policy medication_events_insert on public.medication_events
  for insert to authenticated
  with check (
    patient_id = (select app_private.current_patient_id())
    or (
      kind in ('taken', 'reminder_set')
      and (select app_private.can_view_patient(patient_id, 'reminders'))
    )
  );

create policy medications_reminder_select on public.medications
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'reminders')));

create policy medications_reminder_update on public.medications
  for update to authenticated
  using ((select app_private.can_view_patient(patient_id, 'reminders')))
  with check ((select app_private.can_view_patient(patient_id, 'reminders')));

create policy prescriptions_select on public.prescriptions
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'medications')));

create policy prescriptions_write on public.prescriptions
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy appointments_select on public.appointments
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'appointments')));

create policy appointments_write on public.appointments
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy concerns_select on public.health_concerns
  for select to authenticated
  using (
    (select app_private.can_view_patient(patient_id, 'concerns'))
    and (
      patient_id = (select app_private.current_patient_id())
      or shared_with_care_team
    )
  );

create policy concerns_write on public.health_concerns
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy timeline_select on public.health_timeline
  for select to authenticated
  using (
    (
      (select app_private.can_view_patient(patient_id, 'timeline'))
      or (select app_private.can_view_patient(patient_id, 'medications'))
      or (select app_private.can_view_patient(patient_id, 'appointments'))
      or (select app_private.can_view_patient(patient_id, 'concerns'))
    )
    and (
      patient_id = (select app_private.current_patient_id())
      or kind not in ('concern', 'image')
      or exists (
        select 1 from public.health_concerns concern
        where concern.id = ref_id and concern.shared_with_care_team
      )
    )
  );

create policy timeline_insert on public.health_timeline
  for insert to authenticated
  with check (
    patient_id = (select app_private.current_patient_id())
    or (
      kind = 'doctor_note'
      and (select app_private.can_view_patient(patient_id, 'notes'))
      and (select app_private.current_doctor_id()) is not null
    )
    or (
      kind = 'medication_activity'
      and (select app_private.can_view_patient(patient_id, 'reminders'))
    )
  );

create policy files_select on public.health_files
  for select to authenticated
  using (
    (bucket = 'concerns' and (select app_private.can_view_patient(patient_id, 'concerns')))
    or (bucket = 'prescriptions' and (select app_private.can_view_patient(patient_id, 'medications')))
    or (bucket = 'documents' and (select app_private.can_view_patient(patient_id, 'documents')))
  );

create policy files_insert on public.health_files
  for insert to authenticated
  with check (patient_id = (select app_private.current_patient_id()));

create policy documents_select on public.health_documents
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'documents')));

create policy documents_write on public.health_documents
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy notes_select on public.doctor_notes
  for select to authenticated
  using ((select app_private.can_view_patient(patient_id, 'notes')));

create policy notes_insert on public.doctor_notes
  for insert to authenticated
  with check (
    doctor_id = (select app_private.current_doctor_id())
    and (select app_private.can_view_patient(patient_id, 'notes'))
  );

create policy conversations_all on public.ai_conversations
  for all to authenticated
  using (patient_id = (select app_private.current_patient_id()))
  with check (patient_id = (select app_private.current_patient_id()));

create policy messages_all on public.ai_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.ai_conversations conversation
      where conversation.id = conversation_id
        and conversation.patient_id = (select app_private.current_patient_id())
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations conversation
      where conversation.id = conversation_id
        and conversation.patient_id = (select app_private.current_patient_id())
    )
  );

create policy notifications_select on public.notifications
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy notifications_update on public.notifications
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Cross-user notices (a clinician writing to a patient) are inserted by the
-- server with the secret key after the application checks the care relationship.
-- Authenticated clients cannot insert notifications for someone else.

grant usage on schema app_private to authenticated, service_role;
grant execute on function app_private.current_patient_id() to authenticated, service_role;
grant execute on function app_private.current_doctor_id() to authenticated, service_role;
grant execute on function app_private.can_view_patient(uuid, text) to authenticated, service_role;
grant execute on function app_private.can_view_profile(uuid) to authenticated, service_role;

grant select, update on public.profiles to authenticated;
grant select, update on public.patients to authenticated;
grant select on public.doctors to authenticated;
grant select on public.caregivers to authenticated;
grant select, insert, update, delete on public.patient_doctors to authenticated;
grant select, insert, update, delete on public.caregiver_permissions to authenticated;
grant select, insert, update, delete on public.medications to authenticated;
grant select, insert on public.medication_events to authenticated;
grant select, insert, update, delete on public.prescriptions to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.health_concerns to authenticated;
grant select, insert on public.health_timeline to authenticated;
grant select, insert on public.health_files to authenticated;
grant select, insert, update, delete on public.health_documents to authenticated;
grant select, insert on public.doctor_notes to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
grant select, update on public.notifications to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'health-files',
  'health-files',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;

create policy health_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'health-files'
    and (select app_private.can_view_patient(((storage.foldername(name))[1])::uuid, 'files'))
  );

create policy health_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'health-files'
    and (storage.foldername(name))[1] = (select app_private.current_patient_id())::text
  );
