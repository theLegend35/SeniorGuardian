-- A linked clinician can replace a saved prescription. Caregivers still cannot.
-- The patient remains able to write their own medicines through the existing policies.

create policy medications_clinician_update on public.medications
  for update to authenticated
  using (
    exists (
      select 1
      from public.patient_doctors link
      where link.patient_id = medications.patient_id
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.patient_doctors link
      where link.patient_id = medications.patient_id
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
    )
  );

create policy prescriptions_clinician_update on public.prescriptions
  for update to authenticated
  using (
    exists (
      select 1
      from public.patient_doctors link
      where link.patient_id = prescriptions.patient_id
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.patient_doctors link
      where link.patient_id = prescriptions.patient_id
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
    )
  );

create policy medication_events_clinician_insert on public.medication_events
  for insert to authenticated
  with check (
    kind = 'updated'
    and exists (
      select 1
      from public.patient_doctors link
      where link.patient_id = medication_events.patient_id
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
    )
  );

create policy timeline_clinician_medication on public.health_timeline
  for insert to authenticated
  with check (
    kind = 'medication_change'
    and exists (
      select 1
      from public.patient_doctors link
      where link.patient_id = health_timeline.patient_id
        and link.doctor_id = (select app_private.current_doctor_id())
        and link.status = 'active'
    )
  );
