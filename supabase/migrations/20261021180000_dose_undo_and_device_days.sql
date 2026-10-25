-- Second round of fixes, October 21, 2026.

-- 1. "Mark taken" can be undone.
-- The patient, or a caregiver who manages reminders, can remove a "taken" mark saved in the last day.
-- Other medication events (added, updated, archived, reminder_set) stay permanent.
drop policy if exists medication_events_undo_taken on public.medication_events;
create policy medication_events_undo_taken on public.medication_events
  for delete to authenticated
  using (
    kind = 'taken'
    and created_at > now() - interval '1 day'
    and (
      patient_id = (select app_private.current_patient_id())
      or (select app_private.can_view_patient(patient_id, 'reminders'))
    )
  );

grant delete on public.medication_events to authenticated;

-- Every undo is written to the timeline by the database itself, so the history keeps it even when the delete
-- comes straight from the API. A delete caused by removing a whole medicine or patient (a cascade) is skipped.
create or replace function app_private.record_taken_undo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  medicine text;
  label text;
  who text;
  who_role text;
  clock text;
begin
  if old.kind <> 'taken' or pg_trigger_depth() > 1 then
    return old;
  end if;
  if not exists (select 1 from public.patients where id = old.patient_id) then
    return old;
  end if;
  select m.name, m.instructions into medicine, label from public.medications m where m.id = old.medication_id;
  if medicine is null then
    return old;
  end if;
  select p.full_name, p.role into who, who_role from public.profiles p where p.id = (select auth.uid());
  clock := case
    when old.scheduled_for ~ 'T[0-9]{2}:[0-9]{2}$'
      then to_char(('2000-01-01 ' || right(old.scheduled_for, 5))::timestamp, 'FMHH12:MI AM')
    else 'saved'
  end;
  insert into public.health_timeline (patient_id, kind, title, summary, source_label, ref_table, ref_id)
  values (
    old.patient_id,
    'medication_activity',
    'Taken mark removed: ' || medicine,
    'The ' || clock || ' dose is back to not taken. Instructions remain: ' || coalesce(label, ''),
    case
      when who_role = 'patient' then 'Changed by the patient'
      when who_role = 'caregiver' then 'Changed by ' || coalesce(nullif(who, ''), 'a caregiver') || ', caregiver'
      else 'Changed in the record'
    end,
    'medications',
    old.medication_id
  );
  return old;
end
$$;

drop trigger if exists medication_events_record_undo on public.medication_events;
create trigger medication_events_record_undo
  after delete on public.medication_events
  for each row execute function app_private.record_taken_undo();

-- 2. One device reading per device, metric, and day.
-- A sync used to save the same daily number again every time it ran. measured_on is the day the device company
-- says the number belongs to; a second sync of that day updates the saved reading. Older rows keep a null day,
-- and nulls never collide in a unique index, so nothing already saved is changed or removed.
alter table public.device_readings add column if not exists measured_on date;

create unique index if not exists device_readings_one_per_day
  on public.device_readings (connection_id, metric, measured_on);
