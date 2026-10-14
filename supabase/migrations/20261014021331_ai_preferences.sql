-- Per-person model choice. The API key stays on the server.
-- No policies: the browser client cannot read this table. The server uses the secret key.

create table public.ai_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null default 'ours' check (provider in ('ours', 'groq', 'claude', 'gemini', 'chatgpt')),
  ours_choice text not null default 'gemini' check (ours_choice in ('gemini', 'grok')),
  model text not null default '',
  api_key text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.ai_preferences enable row level security;
alter table public.ai_preferences force row level security;

revoke all on table public.ai_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_preferences to service_role;
