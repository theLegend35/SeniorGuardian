const TERMS: Array<{ term: string; pattern: RegExp; plain: string }> = [
  { term: "Twice a day", pattern: /\btwice daily\b|\btwice a day\b|\bb\.?i\.?d\.?\b/i, plain: "Two times during the day, usually about 12 hours apart unless the label says otherwise." },
  { term: "Once a day", pattern: /\bonce daily\b|\bonce a day\b|\bevery morning\b|\bq\.?d\.?\b/i, plain: "One time each day, at the time written on the label." },
  { term: "Three times a day", pattern: /\bthree times a day\b|\bt\.?i\.?d\.?\b/i, plain: "Three times spread through the day, often with meals." },
  { term: "Every 8 hours", pattern: /\bevery 8\b|\bq8h\b/i, plain: "Leave about 8 hours between doses. It is not the same as three meals." },
  { term: "As needed", pattern: /\bas needed\b|\bp\.?r\.?n\.?\b/i, plain: "Only when you have the symptom it is for, and never more often than the label allows." },
  { term: "At bedtime", pattern: /\bat bedtime\b|\bh\.?s\.?\b/i, plain: "Take it shortly before you go to sleep for the night." },
  { term: "With food", pattern: /\bwith food\b|\bwith meals\b|\bwith breakfast\b|\bwith dinner\b/i, plain: "Take it with a meal or snack, not on an empty stomach." },
  { term: "By mouth", pattern: /\bby mouth\b|\boral(ly)?\b|\bp\.?o\.?\b/i, plain: "Swallow it." },
  { term: "Swallow whole", pattern: /\bswallow whole\b|\bdo not crush\b|\bdo not chew\b/i, plain: "Do not cut, crush, or chew it. Some tablets release medicine slowly and only work whole." },
  { term: "ER / extended release", pattern: /\bER\b|\bXL\b|\bextended[- ]release\b|\bsuccinate ER\b/, plain: "The tablet releases medicine slowly over the day." },
  { term: "High blood pressure", pattern: /\bhypertension\b|\bhigh blood pressure\b|\bblood pressure\b/i, plain: "The force of blood against artery walls. Your clinician sets the target that is right for you." },
  { term: "Type 2 diabetes", pattern: /\btype 2 diabetes\b/i, plain: "The body has trouble using insulin well, so blood sugar can run high." },
  { term: "A1c", pattern: /\bA1c\b/i, plain: "A blood test that shows average blood sugar over about three months." },
  { term: "eGFR", pattern: /\beGFR\b/i, plain: "An estimate of how well the kidneys filter blood. Your clinician compares it with past results." },
  { term: "Creatinine", pattern: /\bcreatinine\b/i, plain: "A waste product the kidneys clear from the blood. It is used to check kidney function." },
  { term: "Potassium", pattern: /\bpotassium\b/i, plain: "A mineral that helps the heart and muscles work. Some blood pressure medicines can change it." },
  { term: "Sodium", pattern: /\bsodium\b/i, plain: "A mineral that helps balance fluid in the body." },
  { term: "Fasting glucose", pattern: /\bglucose\b/i, plain: "Blood sugar. A fasting result is taken before eating." },
  { term: "Cholesterol", pattern: /\bcholesterol\b|\blipid panel\b/i, plain: "A fatty substance in the blood. A lipid panel measures the different kinds." },
  { term: "LDL", pattern: /\bLDL\b/, plain: "Often called “bad” cholesterol. It can build up in blood vessels." },
  { term: "HDL", pattern: /\bHDL\b/, plain: "Often called “good” cholesterol. It helps carry cholesterol away from blood vessels." },
  { term: "Triglycerides", pattern: /\btriglycerides?\b/i, plain: "A type of fat in the blood. It can change with recent meals." },
  { term: "mg/dL", pattern: /\bmg\/dL\b/i, plain: "The unit many blood tests use: milligrams in a small amount of blood." },
  { term: "Hemoglobin", pattern: /\bhemoglobin\b|\bHgb\b/i, plain: "The part of red blood cells that carries oxygen." },
  { term: "TSH", pattern: /\bTSH\b/, plain: "A blood test that checks how the thyroid gland is working." },
  { term: "BMP / CMP", pattern: /\bmetabolic panel\b|\bBMP\b|\bCMP\b/i, plain: "A group of blood tests for kidney function, blood sugar, and minerals." },
  { term: "CBC", pattern: /\bCBC\b|\bcomplete blood count\b/i, plain: "A count of the red cells, white cells, and platelets in the blood." },
  { term: "Follow-up", pattern: /\bfollow[- ]up\b|\breturn in\b/i, plain: "A planned check-in visit with your clinician." },
  { term: "HIGH / LOW flags", pattern: /\b(HIGH|LOW)\b/, plain: "The result is outside the lab's usual range. That is a reason to ask about it, not a diagnosis by itself." },
];

export function explainPhrase(text: string): string[] {
  return TERMS.filter((item) => item.pattern.test(text)).map((item) => `${item.term}: ${item.plain}`);
}

export function glossaryFor(text: string): Array<{ term: string; plain: string }> {
  return TERMS.filter((item) => item.pattern.test(text)).map(({ term, plain }) => ({ term, plain }));
}
