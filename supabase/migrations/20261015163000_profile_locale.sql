alter table public.profiles
  add column if not exists locale text not null default 'en' check (locale in ('en', 'es'));
