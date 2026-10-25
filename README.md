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

The phone app needs a development build (`npx expo run:android` or `npx expo run:ios`), not Expo Go. Rebuild it after native changes such as new packages or permissions. A build that is older than the code still opens; it just skips what the new native parts do.

### Phone reminders and alerts

- Reminders are scheduled on the phone for the next 7 days. They refresh when the app opens and, on a current build, in the background (Android about every 30 minutes when the phone allows; iOS chooses the time). A medicine stopped on the website stops ringing at the next refresh.
- Android 12 and newer can hold a reminder for a few minutes unless **Alarms & reminders** is allowed for the app. The app asks for that permission and links to the setting on the reminders screen.
- Care-team alerts (push messages from the website) need an Expo (EAS) project. From `mobile/`, run `npx eas-cli init`; it writes the project ID into `app.json`. Or set `EXPO_PUBLIC_EAS_PROJECT_ID` in `mobile/.env`. Android also needs Firebase: add `google-services.json` (set `android.googleServicesFile` in `app.json`) and upload the FCM key with `npx eas-cli credentials`. iOS needs a paid Apple developer account. Without these, reminders still ring, and the reminders screen says that care-team alerts are not set up.

## Run the website

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Add a different port with `npm run dev -- -p 3001`. Create an account from the site when Supabase is configured. The sign-in page also lists three sample accounts (patient, clinician, and caregiver) that sign in through Supabase.

To use the site from a phone on the same Wi-Fi (the phone app, the microphone, or location), it needs HTTPS. Install [mkcert](https://github.com/FiloSottile/mkcert), then from `web/` run `mkcert -install` and `mkcert -key-file certificates/localhost-key.pem -cert-file certificates/localhost.pem localhost 127.0.0.1 <this computer's Wi-Fi address>`. With those two files present, `npm run dev` serves https://localhost:3000 instead. The files are not in git, so each computer makes its own.

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
| `GOOGLE_TRANSLATE_API_KEY` | Google Cloud, with **Cloud Translation API** enabled (needs billing; a free monthly amount is included) | Optional. Menus, buttons, safety lines, dates, and times already have built-in Spanish (`web/lib/i18n/es.ts`). Other text (notes, AI explanations) uses this official service when the key is set, otherwise the site's Gemini key within a daily limit (`TRANSLATE_AI_DAILY_LIMIT`, default 200 calls). The unofficial Google Translate address is no longer used |
| `GOOGLE_MAPS_API_KEY` | Google Cloud, with **Places API (New)** enabled | Optional. Find care already uses your location and OpenStreetMap. This key switches the place list to Google |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud, with **Maps JavaScript API** enabled, restricted to your site's HTTP referrers | Optional Google map tiles. Without it, the map is OpenStreetMap. Sent to the browser |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Google Cloud → Map Management | Optional custom map styling |
| `DEMO_SESSION_SECRET` | Any long random string | Signs the session cookie and device sign-in. Set it on the live site. If it is missing there, a key is derived from `SUPABASE_SECRET_KEY`, and a live site with neither refuses to sign in |
| `GOOGLE_HEALTH_CLIENT_ID` and `GOOGLE_HEALTH_CLIENT_SECRET` | [Google Health setup](https://developers.google.com/health/setup) | Sign-in that reads Fitbit and Pixel Watch. Server only |
| `OURA_CLIENT_ID` and `OURA_CLIENT_SECRET` | [Oura authentication](https://cloud.ouraring.com/docs/authentication) | Sign-in that reads an Oura Ring generation 3 or later. Server only |
| `WITHINGS_CLIENT_ID` and `WITHINGS_CLIENT_SECRET` | [Withings developer](https://developer.withings.com/) | Sign-in that reads ScanWatch, scales, BPM, and Sleep Analyzer. Server only |

Any OpenAI-compatible provider also works through `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. Those keys stay on the server. Do not prefix them with `NEXT_PUBLIC_`.

## Safety rules the code enforces

- The assistant can explain saved prescription text but never invents or changes a dose. An amount in a reply must appear, with its unit, on the label of the medicine it is said about ("20 mg of lisinopril" is refused when only atorvastatin is 20 mg). Spelled-out numbers count, and wording such as "take an extra tablet" is refused unless the label says it. Such replies are replaced with the offline answer. Concern reviews and the caregiver and clinician assistants use the same check.
- A reminder is refused if it would add more daily reminders than the label's doses per day. Digits and "every 6 hours" count, so "3 times daily" allows three. A weekly, every-other-day, or set-weekday medicine is only due, and only rings, on its own days.
- A medicine taken only when needed ("as needed", "PRN") gets at most as many reminder times as its label allows ("no more than 4 doses in 24 hours", "every 6 hours"), and only one when the label gives no number.
- A dose can be marked taken from one hour before its time, not earlier, and a mistaken mark can be undone the same day.
- A device sync keeps one reading per device, metric, and day, and sends a notice for that day once. A step count for a day that is not over is not flagged as too low.
- The original label, patient words, and photos stay beside any generated text.
- The concern flow is Check a Health Concern.
- A clinician or caregiver sees a patient only through an authorization the patient grants, and caregivers see only the sections the patient chooses. Caregivers never see conditions, address, blood type, or the emergency contact, and see allergies only with Medicines.
- A patient adds a clinician or caregiver by email, so those accounts must confirm their email address before they can be added.
- Concern photos reach the care team only with a concern the patient shared. A chat message always shows its real author.
- The three sample accounts are shared, so their password, email, name, and AI model cannot be changed.

## Supabase

When `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` are set, sign-in and records use that project. The schema is in `supabase/migrations`. Row level security is what decides patient, clinician, and caregiver access. Roles live in `app_metadata` and `profiles`. Leave the three values empty to keep the local file. Do not put the secret key in the phone app or the browser.

Apply new migrations from the project folder with `npx supabase db push`. `20261021090000_tighten_access.sql` protects the sample accounts at the database too. To change a sample password on purpose, its first comment shows how to switch that off for a moment. `20261021180000_dose_undo_and_device_days.sql` lets a "taken" mark be undone and keeps one device reading per day.

Clinician and caregiver sign-ups get a confirmation email from Supabase. Under Authentication → URL Configuration, the site's `/auth/confirm` address must be an allowed redirect URL. Supabase's built-in email service only delivers to a few addresses, so set up custom SMTP before real clinicians sign up. Until email works, `CLINICIAN_EMAIL_CONFIRMATION=off` turns the check off (anyone could then claim a clinician's email again).
