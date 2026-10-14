-- A linked clinician may replace the saved prescription wording.
-- A caregiver may still change only the reminder schedule.

create or replace function app_private.protect_prescription_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if (select app_private.current_patient_id()) = old.patient_id then
    return new;
  end if;
  if exists (
    select 1
    from public.patient_doctors link
    where link.patient_id = old.patient_id
      and link.doctor_id = (select app_private.current_doctor_id())
      and link.status = 'active'
  ) then
    return new;
  end if;
  if (
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
  ) then
    raise exception 'Only reminder times can be changed by a caregiver.';
  end if;
  return new;
end;
$$;

revoke all on function app_private.protect_prescription_text() from public, anon, authenticated;
