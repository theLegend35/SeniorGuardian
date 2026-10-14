# Senior Guardian

Senior Guardian is a health record for older adults and the people they authorize. It keeps medicines, appointments, health concerns, and readings from Google Health (Fitbit and Pixel Watch), Oura, or Withings. Saved text can be explained in plain language. An authorized clinician or caregiver can review the original record.

It does not replace a doctor, nurse, pharmacist, or emergency service. This project is not a claim of HIPAA compliance.

## Layout

| Folder | What it is |
| --- | --- |
| `web/` | Next.js site: patient, clinician, and caregiver portals, plus the marketing page |
| `mobile/` | Expo app on the same Supabase record. Medicine and visit reminders are scheduled on the phone |
| `supabase/migrations/` | Postgres schema, row level security, and storage policies |

From `mobile/`, copy `mobile/.env.example` to `mobile/.env`, then run `npm install` and `npx expo start`. The assistant, label photos, and Find care stay on the website.

## Run the website

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Create an account from the site when Supabase is configured. The sign-in page also lists three sample accounts (patient, clinician, and caregiver) that sign in through Supabase.

With no Supabase keys, records stay in `web/.data/records.txt` on this computer. The health assistant answers from the saved record, and Find care looks up nearby places from OpenStreetMap. Settings → Restore sample records puts those local records back to the start.

## Checks

Run from `web/`:

```bash
npm test
npm run typecheck
npm run build
```

## Keys

Copy `web/.env.example` to `web/.env.local`. Every key is optional.

| Variable | Where to get it | What it turns on |
| --- | --- | --- |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Answers in the health-record assistant, photo reading for labels and documents, concern reviews, and clinician summaries |
| `GROQ_API_KEY` | [Groq console](https://console.groq.com/keys) | The public-site chat. Server only. It does not replace the health-record assistant |
| `GOOGLE_MAPS_API_KEY` | Google Cloud, with **Places API (New)** enabled | Optional. Find care already uses your location and OpenStreetMap. This key switches the place list to Google |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud, with **Maps JavaScript API** enabled, restricted to your site's HTTP referrers | Optional Google map tiles. Without it, the map is OpenStreetMap. Sent to the browser |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Google Cloud → Map Management | Optional custom map styling |
| `DEMO_SESSION_SECRET` | Any long random string | Signs the session cookie. Required in production |
| `GOOGLE_HEALTH_CLIENT_ID` and `GOOGLE_HEALTH_CLIENT_SECRET` | [Google Health setup](https://developers.google.com/health/setup) | Sign-in that reads Fitbit and Pixel Watch. Server only |
| `OURA_CLIENT_ID` and `OURA_CLIENT_SECRET` | [Oura authentication](https://cloud.ouraring.com/docs/authentication) | Sign-in that reads an Oura Ring generation 3 or later. Server only |
| `WITHINGS_CLIENT_ID` and `WITHINGS_CLIENT_SECRET` | [Withings developer](https://developer.withings.com/) | Sign-in that reads ScanWatch, scales, BPM, and Sleep Analyzer. Server only |

Any OpenAI-compatible provider also works through `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. Those keys stay on the server. Do not prefix them with `NEXT_PUBLIC_`.

## Safety rules the code enforces

- The assistant can explain saved prescription text but never invents or changes a dose. Replies that mention an amount not found in the record are replaced with the offline answer.
- A reminder is refused if it would add more daily reminders than the label's doses per day.
- The original label, patient words, and photos stay beside any generated text.
- The concern flow is Check a Health Concern.
- A clinician or caregiver sees a patient only through an authorization the patient grants, and caregivers see only the sections the patient chooses.

## Supabase

When `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` are set, sign-in and records use that project. The schema is in `supabase/migrations`. Row level security is what decides patient, clinician, and caregiver access. Roles live in `app_metadata` and `profiles`. Leave the three values empty to keep the local file. Do not put the secret key in the phone app or the browser.
