const EMERGENCY =
  /\b(chest pain|can't breathe|cannot breathe|trouble breathing|shortness of breath|stroke|face drooping|slurred speech|unconscious|passed out|severe bleeding|suicidal|kill myself|anaphylaxis)\b/i;

const DOSE_CHANGE =
  /\b(change|increase|decrease|raise|lower|double|skip|stop taking|take more|take less|new dose|higher dose|lower dose)\b.{0,40}\b(dose|dosage|mg|tablet|pill|medication|medicine)\b|\b(dose|dosage)\b.{0,40}\b(change|increase|decrease|double|skip)\b/i;

export const MEDICAL_DISCLAIMER =
  "Senior Guardian is an informational and organizational health record. It does not replace doctors, nurses, pharmacists, or emergency medical services. AI-powered explanations may be incomplete or incorrect. Contact a qualified healthcare professional for medical advice and urgent concerns.";

export function safetyResponse(question: string): string | null {
  if (EMERGENCY.test(question)) {
    return "This may need emergency help. Call emergency services or your local emergency number now. If you are in the United States, call 911. I cannot assess an emergency, and I am not a doctor.";
  }
  if (DOSE_CHANGE.test(question)) {
    return "I can’t change a dose or a medication schedule. Your prescribing clinician or pharmacist is the right person to make that decision. The prescription saved in Senior Guardian stays as it was entered. I can help you write a question to take to that visit.";
  }
  return null;
}
