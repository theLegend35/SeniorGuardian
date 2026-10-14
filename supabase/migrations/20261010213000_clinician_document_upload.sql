-- An authorized clinician can add a document and its file.
-- Existing patient-only policies stay in place. These extra insert policies
-- allow a doctor only when can_view_patient already grants documents.

create policy documents_clinician_insert on public.health_documents
  for insert to authenticated
  with check (
    (select app_private.current_doctor_id()) is not null
    and (select app_private.can_view_patient(patient_id, 'documents'))
  );

create policy files_clinician_insert on public.health_files
  for insert to authenticated
  with check (
    bucket = 'documents'
    and (select app_private.current_doctor_id()) is not null
    and (select app_private.can_view_patient(patient_id, 'documents'))
  );

create policy timeline_clinician_document on public.health_timeline
  for insert to authenticated
  with check (
    kind = 'document'
    and (select app_private.current_doctor_id()) is not null
    and (select app_private.can_view_patient(patient_id, 'documents'))
  );

create policy health_files_clinician_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'health-files'
    and (select app_private.current_doctor_id()) is not null
    and (select app_private.can_view_patient(((storage.foldername(name))[1])::uuid, 'documents'))
  );
