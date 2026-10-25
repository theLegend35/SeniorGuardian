-- Tighter access rules after the October review.
--
-- 1. Sample accounts (@demo.seniorhelp.test) keep their shared password (Demo1234!), email, name,
--    and phone, so one visitor cannot lock everyone else out. To change a sample password on purpose, first run:
--      create or replace function app_private.is_sample_email(address text) returns boolean
--        language sql immutable set search_path = '' as $f$ select false $f$;
--    and put this migration's version of the function back afterwards.
-- 2. profiles.email follows the sign-in email in auth.users and cannot be edited directly,
--    because patients add a clinician or caregiver by that address.
-- 3. Caregivers no longer read the patients row (conditions, allergies, address).
--    public.care_people() gives them the name, and the birth date once a section is shared.
-- 4. Each timeline entry follows the section it belongs to.
-- 5. A file follows its own row: a concern photo needs a shared concern, and storage
--    downloads follow public.health_files instead of the whole patient folder.
-- 6. A care chat message carries the author's real name and role from their profile.

-- 1. Sample accounts ---------------------------------------------------------

create or replace function app_private.is_sample_email(address text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(coalesce(address, '')) like '%@demo.seniorhelp.test'
$$;

revoke all on function app_private.is_sample_email(text) from public, anon, authenticated;

create or replace function app_private.protect_sample_logins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.is_sample_email(old.email) then
    return new;
  end if;
  if new.email is distinct from old.email then
    raise exception 'Sample accounts keep their shared email.';
  end if;
  if new.encrypted_password is distinct from old.encrypted_password then
    -- Supabase may re-save the same password in a newer hash format while signing in.
    -- That is allowed. Only a different password is refused.
    begin
      if extensions.crypt('Demo1234!', new.encrypted_password) = new.encrypted_password then
        return new;
      end if;
    exception when others then
      -- The new hash can't be checked here, so never risk blocking a sign-in.
      return new;
    end;
    raise exception 'Sample accounts keep their shared password.';
  end if;
  return new;
end;
$$;

revoke all on function app_private.protect_sample_logins() from public, anon, authenticated;

create trigger auth_users_protect_samples
  before update of encrypted_password, email on auth.users
  for each row execute function app_private.protect_sample_logins();

-- 2. Profile email follows the sign-in email -----------------------------------

create or replace function app_private.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Signed-in users cannot change a role or the email patients use to find them.
  -- The server (secret key) and the auth email sync below run without a signed-in user.
  if tg_op = 'UPDATE' and (select auth.uid()) is not null then
    if new.role is distinct from old.role then
      raise exception 'role cannot be changed';
    end if;
    if new.email is distinct from old.email then
      raise exception 'The profile email follows the sign-in email and cannot be changed here.';
    end if;
    if app_private.is_sample_email(old.email)
       and (new.full_name is distinct from old.full_name or new.phone is distinct from old.phone) then
      raise exception 'Sample accounts keep their name and phone.';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function app_private.protect_profile() from public, anon, authenticated;

create or replace function app_private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function app_private.sync_profile_email() from public, anon, authenticated;

create trigger auth_users_sync_profile_email
  after update of email on auth.users
  for each row execute function app_private.sync_profile_email();

-- 3. Caregivers see a name, not the health details on the patients row ----------

drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1
      from public.patient_doctors link
      where link.patient_id = patients.id
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
    )
  );

create or replace function public.care_people(patient_ids uuid[])
returns table (patient_id uuid, full_name text, date_of_birth date)
language sql
stable
security definer
set search_path = ''
as $$
  select
    patient.id,
    profile.full_name,
    case when app_private.can_view_patient(patient.id, 'overview') then patient.date_of_birth end
  from public.patients patient
  join public.profiles profile on profile.id = patient.profile_id
  where patient.id = any(patient_ids)
    and (
      patient.profile_id = (select auth.uid())
      or exists (
        select 1
        from public.patient_doctors link
        where link.patient_id = patient.id
          and link.doctor_id = (select app_private.current_doctor_id())
          and link.status = 'active'
      )
      or exists (
        select 1
        from public.caregiver_permissions grant_row
        join public.caregivers caregiver on caregiver.id = grant_row.caregiver_id
        where grant_row.patient_id = patient.id
          and caregiver.profile_id = (select auth.uid())
          and grant_row.status = 'active'
      )
    )
$$;

revoke all on function public.care_people(uuid[]) from public, anon;
grant execute on function public.care_people(uuid[]) to authenticated, service_role;

-- 4. Timeline entries follow their own section ----------------------------------

drop policy if exists timeline_select on public.health_timeline;
create policy timeline_select on public.health_timeline
  for select to authenticated
  using (
    (
      case kind
        when 'concern' then app_private.can_view_patient(patient_id, 'concerns')
        when 'image' then app_private.can_view_patient(patient_id, 'concerns')
        when 'medication_change' then app_private.can_view_patient(patient_id, 'medications')
        when 'medication_activity' then app_private.can_view_patient(patient_id, 'medications')
        when 'appointment' then app_private.can_view_patient(patient_id, 'appointments')
        when 'doctor_note' then app_private.can_view_patient(patient_id, 'notes')
        when 'patient_note' then app_private.can_view_patient(patient_id, 'notes')
        when 'document' then app_private.can_view_patient(patient_id, 'documents')
        else app_private.can_view_patient(patient_id, 'timeline')
      end
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

-- 5. Files follow their own row -----------------------------------------------

drop policy if exists files_select on public.health_files;
create policy files_select on public.health_files
  for select to authenticated
  using (
    (
      bucket = 'concerns'
      and app_private.can_view_patient(patient_id, 'concerns')
      and (
        patient_id = (select app_private.current_patient_id())
        or exists (
          select 1 from public.health_concerns concern
          where concern.image_file_id = health_files.id
            and concern.shared_with_care_team
        )
      )
    )
    or (bucket = 'prescriptions' and app_private.can_view_patient(patient_id, 'medications'))
    or (bucket = 'documents' and app_private.can_view_patient(patient_id, 'documents'))
  );

-- Both the website and the server save files as <patient id>/<file id>.
-- New rows must follow that, so a row cannot point at someone else's folder.
alter table public.health_files
  add constraint health_files_path_in_own_folder
  check (storage_path = patient_id::text || '/' || id::text) not valid;

drop policy if exists health_files_read on storage.objects;
create policy health_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'health-files'
    and (
      (storage.foldername(objects.name))[1] = (select app_private.current_patient_id())::text
      or exists (
        select 1 from public.health_files file
        where file.storage_path = objects.name
          and (storage.foldername(objects.name))[1] = file.patient_id::text
      )
    )
  );

-- 6. Chat messages carry the author's real name and role ------------------------

create or replace function app_private.stamp_care_message_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author record;
begin
  -- The server inserts with the secret key after its own checks and sets these itself.
  if (select auth.uid()) is null then
    return new;
  end if;
  select full_name, role into author from public.profiles where id = (select auth.uid());
  if not found then
    raise exception 'Only a member of the care team can post.';
  end if;
  new.author_id := (select auth.uid());
  new.author_name := coalesce(nullif(btrim(author.full_name), ''), 'Care team member');
  new.author_role := author.role;
  return new;
end;
$$;

revoke all on function app_private.stamp_care_message_author() from public, anon, authenticated;

create trigger care_messages_stamp_author
  before insert on public.care_messages
  for each row execute function app_private.stamp_care_message_author();
