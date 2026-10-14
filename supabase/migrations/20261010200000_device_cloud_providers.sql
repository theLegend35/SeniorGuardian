-- Google Health, Oura, and Withings are the accounts a website can sign in to.
-- Older rows may still say fitbit, watch, or ring. Those cannot start a new sign-in.

alter table public.device_connections drop constraint if exists device_connections_provider_check;

alter table public.device_connections
  add constraint device_connections_provider_check
  check (provider in ('google_health', 'oura', 'withings', 'fitbit', 'watch', 'ring'));
