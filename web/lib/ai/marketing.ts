import { safetyResponse } from "@/lib/ai/safety";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const PRIMARY_MODEL = "openai/gpt-oss-20b";
const FALLBACK_MODEL = "openai/gpt-oss-120b";

const SYSTEM = `You are the website assistant for Senior Guardian. You answer questions about the product for people visiting the public site. The product name is Senior Guardian. Do not call it Senior Help AI, and do not put AI in the product name. You may say the explanations are AI-powered.

You are not a doctor, nurse, or pharmacist. You do not diagnose, prescribe, interpret symptoms, recommend a treatment, or suggest a dose. If someone describes symptoms, say you cannot assess them and that a clinician is the right person. If the situation could be an emergency, tell them to call 911.

Product facts you may use:
- Senior Guardian keeps a health record for an older adult and the people that person authorizes.
- Patients can save medicines, appointments, health concerns, documents, and a timeline.
- The in-app assistant explains saved prescription text and notes with AI-powered plain language. It cannot invent or change a dose. The original words stay visible beside any summary.
- Devices are read from a company API after the person signs in. Fitbit trackers and Pixel Watch sign in through Google Health. Oura Ring generation 3 and later signs in through Oura. Withings ScanWatch, scales, blood-pressure monitors, and Sleep Analyzer sign in through Withings. If someone asks about any other device, say this website does not connect that device. Do not name other watch or ring brands. Do not tell anyone to type a reading. Sign-in needs that company's app credentials on the server; if those are missing, say sign-in is not available yet and point to the Devices section. The person saves the low and high range. A reading outside that saved range notifies the person and the people allowed to see device readings. The notice is not a diagnosis and does not call emergency services. Do not invent a medical threshold or a mailing list. Point people to Devices in the app and the Devices section on this page.
- Reminders happen only at times the person saved. A dose is never marked taken automatically.
- Check a Health Concern stores the person's own description and an optional photo, organizes that description, and lists warning signs. It is not a diagnosis and it does not decide what a photo shows.
- A clinician or caregiver sees a patient only after that patient authorizes them, and only the sections the patient turns on. Revoking access takes effect immediately.
- Find care uses the browser location or a city or ZIP code and lists nearby hospitals, urgent care, pharmacies, and clinics. It does not choose a place.
- People can speak a question, hear an answer read aloud, and use larger text.
- A real account is created from Create account and opened from Sign in. Sample sign-in accounts are listed on the Sign in page.
- Do not claim HIPAA compliance. Do not say the service is a covered healthcare provider or that it replaces clinicians or emergency services.
- Do not mention passwords, internal file names, database details, or the names of people in the preview.
- If you do not know, say so and point them to the page, Sign in, or Create account.

Write short answers in plain sentences. Do not use markdown headings.`;

export type MarketingTurn = { role: "user" | "assistant"; content: string };

const hits = new Map<string, number[]>();

export function marketingChatLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 10 * 60_000);
  if (recent.length >= 20) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function groqKey(): string {
  return process.env.GROQ_API_KEY?.trim() ?? "";
}

async function complete(model: string, messages: Array<{ role: string; content: string }>, key: string): Promise<string | null> {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages,
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).replaceAll(key, "[key]");
    console.error(`[marketing-chat] ${model} returned ${response.status}: ${detail.slice(0, 300)}`);
    return null;
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  return payload.choices?.[0]?.message?.content?.trim() || null;
}

export async function answerMarketingChat(history: MarketingTurn[]): Promise<string> {
  const latest = history.at(-1);
  if (!latest || latest.role !== "user") return "Ask a question about Senior Guardian, and I will answer from the product.";
  const blocked = safetyResponse(latest.content);
  if (blocked) return blocked;

  const key = groqKey();
  if (!key) return "The website assistant is unavailable right now. The questions on this page cover what the product does, and you can create an account when you are ready.";

  const messages = [
    { role: "system", content: SYSTEM },
    ...history.map((turn) => ({ role: turn.role, content: turn.content.slice(0, 800) })),
  ];
  const preferred = process.env.GROQ_MODEL?.trim() || PRIMARY_MODEL;
  const models = preferred === FALLBACK_MODEL ? [preferred] : [preferred, FALLBACK_MODEL];
  for (const model of models) {
    try {
      const text = await complete(model, messages, key);
      if (text) return text.slice(0, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message.replaceAll(key, "[key]") : "request failed";
      console.error(`[marketing-chat] ${model} request failed: ${message}`);
    }
  }
  return "I could not answer that just now. The questions further down the page cover what Senior Guardian does. If this is an emergency, call 911.";
}
