import assert from "node:assert/strict";
import test from "node:test";

import { doseAmounts, inventsAmounts, misattributesAmounts } from "@/lib/ai/amounts";
import { medicinesInBrief } from "@/lib/ai/caregiver";

const medicines = [
  { id: "lis", name: "Lisinopril 10 mg tablet", text: "Take one 10 mg tablet by mouth every morning. Do not stop or change this dose unless Dr. Hale tells you to." },
  { id: "met", name: "Metformin 500 mg tablet", text: "Take one 500 mg tablet by mouth twice a day with breakfast and dinner." },
  { id: "ato", name: "Atorvastatin 20 mg tablet", text: "Take one 20 mg tablet by mouth once a day at bedtime." },
  { id: "vit", name: "Vitamin D3 1,000 IU capsule", text: "Take one capsule by mouth once a day with food." },
];
const record = JSON.stringify({ medications: medicines, appointments: [{ startsAt: "2026-10-24T15:30:00Z", location: "Suite 24" }] });
const blocked = (reply: string, ids: string[] = []) => inventsAmounts(reply, record) || misattributesAmounts(reply, medicines, ids);

test("amounts are read with their unit, in words or digits", () => {
  assert.deepEqual(doseAmounts("Take one 10 mg tablet"), ["10 mg", "1 dose"]);
  assert.deepEqual(doseAmounts("twenty milligrams"), ["20 mg"]);
  assert.deepEqual(doseAmounts("1,000 IU"), ["1000 iu"]);
  assert.deepEqual(doseAmounts("1 to 2 capsules"), ["1 dose", "2 dose"]);
  assert.deepEqual(doseAmounts("half a tablet"), ["0.5 dose"]);
  assert.deepEqual(doseAmounts("Your visit is on the 24th at 10:30"), []);
});

test("an amount from another medicine's label is not accepted", () => {
  assert.equal(blocked("Take 20 mg of lisinopril."), true);
  assert.equal(blocked("Lisinopril 10 mg tablet. You can take 20 mg instead."), true);
  assert.equal(blocked("Your metformin is 20 mg twice a day."), true);
  assert.equal(blocked("You can take 20 mg instead.", ["lis"]), true);
});

test("amounts that are nowhere in the record are not accepted", () => {
  assert.equal(blocked("Take 10 tablets."), true);
  assert.equal(blocked("Take 24 mg."), true);
  assert.equal(blocked("Take two tablets of lisinopril."), true);
  assert.equal(blocked("Take twenty milligrams of lisinopril."), true);
  assert.equal(blocked("Vitamin D3 is 2,000 IU a day."), true);
});

test("a reply that copies the label is accepted", () => {
  assert.equal(blocked("Lisinopril 10 mg tablet. The label says: “Take one 10 mg tablet by mouth every morning.”"), false);
  assert.equal(blocked("Take one tablet of metformin with breakfast and one with dinner."), false);
  assert.equal(blocked("Your metformin is 500 mg twice a day; your atorvastatin is 20 mg at bedtime."), false);
  assert.equal(blocked("You take lisinopril 10 mg, metformin 500 mg, and atorvastatin 20 mg."), false);
  assert.equal(blocked("Vitamin D3 is 1,000 IU once a day."), false);
  assert.equal(blocked("Ask your pharmacist if you have questions."), false);
});

test("telling someone to take more or less is caught unless the label says it", () => {
  assert.equal(blocked("You could take an extra tablet if you miss a dose."), true);
  assert.equal(blocked("You could double your dose tomorrow."), true);
  assert.equal(blocked("Do not take an extra tablet if you miss a dose."), false);
  assert.equal(inventsAmounts("You may take another dose after 4 hours.", "May take another dose after 4 hours if needed."), false);
});

test("each amount is checked against the medicine it sits next to", () => {
  assert.equal(blocked("Take lisinopril 20 mg in the morning and atorvastatin 10 mg at bedtime."), true);
  assert.equal(blocked("Take 10 mg of lisinopril and 20 mg of atorvastatin."), false);
  assert.equal(blocked("Take two lisinopril tablets today."), true);
  assert.equal(blocked("On day 2 take your tablets as usual."), false);
});

test("a schedule more often than the label is not accepted", () => {
  const withFrequency = medicines.map((medicine) => ({ ...medicine, text: `${medicine.text}\n${medicine.id === "met" ? "Twice a day" : "Once a day"}` }));
  assert.equal(misattributesAmounts("Take lisinopril 10 mg twice a day.", withFrequency), true);
  assert.equal(misattributesAmounts("Lisinopril: twice a day.", withFrequency), true);
  assert.equal(misattributesAmounts("Take metformin 500 mg twice a day.", withFrequency), false);
});

test("careful wording, lab results, and other names for a medicine are accepted", () => {
  assert.equal(blocked("Do not change, increase, or lower your dose without talking to Dr. Hale."), false);
  assert.equal(blocked("Only your doctor can decide to increase or lower your dose."), false);
  assert.equal(blocked("Your doctor says you can double your dose."), true);
  assert.equal(inventsAmounts("Her LDL was 162 mg/dL while on atorvastatin 20 mg.", `${record} LDL cholesterol 162 mg/dL High`), false);
  const thyroid = [{ name: "Synthroid (levothyroxine) 50 mcg tablet", text: "Take one tablet every morning." }];
  assert.equal(misattributesAmounts("Your levothyroxine is 50 mcg each morning.", thyroid), false);
  assert.equal(misattributesAmounts("Your levothyroxine is 100 mcg each morning.", thyroid), true);
});

test("the caregiver brief lists each medicine with its label", () => {
  const brief = "Person: Eleanor Walsh\nMedicine: Lisinopril 10 mg tablet\nLabel: Take one 10 mg tablet by mouth every morning.\nMedicines: none active were shared.";
  assert.deepEqual(medicinesInBrief(brief), [{ name: "Lisinopril 10 mg tablet", text: "Take one 10 mg tablet by mouth every morning." }]);
  assert.equal(misattributesAmounts("Her lisinopril is 20 mg.", medicinesInBrief(brief)), true);
});
