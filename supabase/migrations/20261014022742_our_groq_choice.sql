-- Our keys can be Gemini or the Groq key used by the quick assistant.

alter table public.ai_preferences drop constraint if exists ai_preferences_ours_choice_check;

update public.ai_preferences
set ours_choice = 'groq'
where ours_choice = 'grok';

alter table public.ai_preferences
  add constraint ai_preferences_ours_choice_check
  check (ours_choice in ('gemini', 'groq'));
