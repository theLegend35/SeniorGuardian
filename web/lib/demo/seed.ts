import { analyzeConcernLocal } from "@/lib/ai/vision";
import { hashPassword } from "@/lib/auth/password";
import { DEMO_PASSWORD, IDS } from "@/lib/demo/ids";
import { practiceImage } from "@/lib/demo/practice-image";
import { addDays, localDate, localHour } from "@/lib/time";
import type {
  CareMessage,
  AiConversation,
  AiMessage,
  AppNotification,
  Appointment,
  Caregiver,
  CaregiverPermission,
  Doctor,
  DoctorNote,
  HealthConcern,
  HealthDocument,
  Medication,
  MedicationEvent,
  Patient,
  PatientDoctor,
  Prescription,
  Profile,
  StoredFile,
  DeviceConnection,
  DeviceReading,
  ReadingRange,
  TimelineEvent,
} from "@/types/domain";

export type DemoProfile = Profile & { passwordHash: string };

export const DEMO_VERSION = 2;

export type DemoDatabase = {
  version: typeof DEMO_VERSION;
  profiles: DemoProfile[];
  patients: Patient[];
  doctors: Doctor[];
  caregivers: Caregiver[];
  patientDoctors: PatientDoctor[];
  caregiverPermissions: CaregiverPermission[];
  medications: Medication[];
  medicationEvents: MedicationEvent[];
  prescriptions: Prescription[];
  appointments: Appointment[];
  healthConcerns: HealthConcern[];
  timeline: TimelineEvent[];
  documents: HealthDocument[];
  files: StoredFile[];
  doctorNotes: DoctorNote[];
  conversations: AiConversation[];
  messages: AiMessage[];
  careMessages: CareMessage[];
  clinicianThreads: Array<{ id: string; doctorId: string; createdAt: string; updatedAt: string }>;
  clinicianMessages: AiMessage[];
  caregiverThreads: Array<{ id: string; caregiverId: string; createdAt: string; updatedAt: string }>;
  caregiverMessages: AiMessage[];
  notifications: AppNotification[];
  deviceConnections: Array<Omit<DeviceConnection, "linked">>;
  deviceSecrets: Array<{ connectionId: string; accessToken: string; refreshToken: string; expiresAt: string }>;
  readingRanges: ReadingRange[];
  deviceReadings: DeviceReading[];
};

export type SeedFile = { id: string; data: Buffer };

const LISINOPRIL =
  "Take one 10 mg tablet by mouth every morning. Do not stop or change this dose unless Dr. Hale tells you to.";
const METFORMIN = "Take one 500 mg tablet by mouth twice a day with breakfast and dinner.";
const ATORVASTATIN = "Take one 20 mg tablet by mouth once a day at bedtime.";
const AMLODIPINE =
  "Take one 5 mg tablet by mouth every morning. Do not stop or change this dose unless Dr. Hale tells you to.";

function profile(id: string, role: Profile["role"], fullName: string, email: string, phone: string, now: string): DemoProfile {
  return {
    id,
    email,
    passwordHash: hashPassword(DEMO_PASSWORD),
    role,
    fullName,
    phone,
    textScale: "default",
    locale: "en",
    createdAt: now,
    updatedAt: now,
  };
}

export function createSeed(now = new Date()): { db: DemoDatabase; files: SeedFile[] } {
  const stamp = now.toISOString();
  const today = localDate(now);
  const yesterday = localDate(new Date(addDays(now, -1, 12, 0)));
  const longAgo = localDate(new Date(addDays(now, -120, 9, 0)));
  const concernAt = addDays(now, -6, 15, 10);
  const privateConcernAt = addDays(now, -2, 16, 40);
  const ruthConcernAt = addDays(now, -1, 19, 5);
  const noteAt = addDays(now, -5, 9, 0);
  const visitAt = addDays(now, -18, 14, 0);

  const eleanorConcern =
    "My left ankle has been puffy for three days. It is not very painful. I did not fall. The skin feels a little tight by the evening.";
  const ruthWords =
    "Both of my ankles look more swollen than usual since Tuesday and my shoes feel tight. I get a little short of breath walking to the mailbox.";

  const med = (input: Partial<Medication> & Pick<Medication, "id" | "patientId" | "name" | "instructions" | "frequency" | "times">): Medication => ({
    startDate: longAgo,
    endDate: null,
    prescribingProvider: "Dr. Marcus Hale",
    notes: "",
    prescriptionId: null,
    status: "active",
    reminderEnabled: true,
    createdAt: addDays(now, -40, 9, 0),
    updatedAt: stamp,
    ...input,
  });

  const medications: Medication[] = [
    med({
      id: IDS.lisinopril,
      patientId: IDS.eleanorPatient,
      name: "Lisinopril 10 mg tablet",
      instructions: LISINOPRIL,
      frequency: "Once a day, morning",
      times: ["08:00"],
      notes: "For blood pressure.",
      prescriptionId: IDS.lisinoprilRx,
    }),
    med({
      id: IDS.metformin,
      patientId: IDS.eleanorPatient,
      name: "Metformin 500 mg tablet",
      instructions: METFORMIN,
      frequency: "Twice a day, with meals",
      times: ["08:00", "18:00"],
      notes: "For blood sugar. Take with food.",
      prescriptionId: IDS.metforminRx,
    }),
    med({
      id: IDS.atorvastatin,
      patientId: IDS.eleanorPatient,
      name: "Atorvastatin 20 mg tablet",
      instructions: ATORVASTATIN,
      frequency: "Once a day, bedtime",
      times: ["21:00"],
      notes: "For cholesterol.",
      prescriptionId: IDS.atorvastatinRx,
    }),
    med({
      id: IDS.vitaminD,
      patientId: IDS.eleanorPatient,
      name: "Vitamin D3 1,000 IU capsule",
      instructions: "Take one capsule by mouth once a day with food.",
      frequency: "Once a day, lunch",
      times: ["12:00"],
      prescribingProvider: "Over the counter",
      notes: "Suggested at the last visit.",
      reminderEnabled: false,
    }),
    med({
      id: IDS.naproxen,
      patientId: IDS.eleanorPatient,
      name: "Naproxen 220 mg tablet",
      instructions: "Take one tablet by mouth every 8 to 12 hours as needed for knee pain. Do not take more than 2 tablets in 24 hours.",
      frequency: "As needed",
      times: [],
      prescribingProvider: "Over the counter",
      notes: "Stopped after the last visit.",
      status: "archived",
      endDate: localDate(new Date(addDays(now, -17, 10, 0))),
      updatedAt: addDays(now, -17, 10, 0),
      reminderEnabled: false,
    }),
    med({
      id: IDS.arthurMed,
      patientId: IDS.arthurPatient,
      name: "Loratadine 10 mg tablet",
      instructions: "Take one 10 mg tablet by mouth once a day.",
      frequency: "Once a day",
      times: ["09:00"],
      prescribingProvider: "Dr. Priya Shah",
      notes: "Private to Arthur. Other people are not authorized.",
      reminderEnabled: false,
    }),
    med({
      id: IDS.furosemide,
      patientId: IDS.ruthPatient,
      name: "Furosemide 20 mg tablet",
      instructions: "Take one 20 mg tablet by mouth every morning.",
      frequency: "Once a day, morning",
      times: ["08:00"],
    }),
    med({
      id: IDS.metoprolol,
      patientId: IDS.ruthPatient,
      name: "Metoprolol succinate ER 25 mg tablet",
      instructions: "Take one 25 mg tablet by mouth once a day. Swallow whole. Do not crush or chew.",
      frequency: "Once a day",
      times: ["08:00"],
    }),
    med({
      id: IDS.amlodipine,
      patientId: IDS.robertPatient,
      name: "Amlodipine 5 mg tablet",
      instructions: AMLODIPINE,
      frequency: "Once a day, morning",
      times: ["08:00"],
      notes: "For blood pressure.",
      prescriptionId: IDS.amlodipineRx,
    }),
  ];

  const medicationEvents: MedicationEvent[] = [];
  for (const item of medications.filter((entry) => entry.patientId === IDS.eleanorPatient && entry.status === "active")) {
    for (const time of item.times) {
      medicationEvents.push({
        id: crypto.randomUUID(),
        medicationId: item.id,
        patientId: item.patientId,
        kind: "taken",
        scheduledFor: `${yesterday}T${time}`,
        note: "Marked taken by the patient.",
        createdAt: addDays(now, -1, Number(time.slice(0, 2)), 6),
      });
      if (time <= "08:00" && localHour(now) >= 9) {
        medicationEvents.push({
          id: crypto.randomUUID(),
          medicationId: item.id,
          patientId: item.patientId,
          kind: "taken",
          scheduledFor: `${today}T${time}`,
          note: "Marked taken by the patient.",
          createdAt: addDays(now, 0, 8, 4),
        });
      }
    }
  }

  const appointments: Appointment[] = [
    {
      id: IDS.upcomingVisit,
      patientId: IDS.eleanorPatient,
      provider: "Dr. Marcus Hale",
      specialty: "Internal medicine",
      startsAt: addDays(now, 4, 10, 30),
      location: "Riverside Family Clinic, 410 Oak Street",
      notes: "Bring your medicine bottles and your home blood pressure log.",
      questions: [
        "Is the ankle swelling related to my blood pressure medicine?",
        "Should I keep taking vitamin D through the winter?",
      ],
      reminderEnabled: true,
      status: "scheduled",
      createdAt: addDays(now, -10, 11, 0),
      updatedAt: stamp,
    },
    {
      id: IDS.eyeVisit,
      patientId: IDS.eleanorPatient,
      provider: "Dr. Priya Nair",
      specialty: "Ophthalmology",
      startsAt: addDays(now, 19, 14, 15),
      location: "Lakeside Eye Center, 2200 Lake Shore Way",
      notes: "Yearly diabetic eye exam. Someone else should drive home.",
      questions: [],
      reminderEnabled: true,
      status: "scheduled",
      createdAt: addDays(now, -3, 10, 0),
      updatedAt: stamp,
    },
    {
      id: IDS.pastVisit,
      patientId: IDS.eleanorPatient,
      provider: "Dr. Marcus Hale",
      specialty: "Internal medicine",
      startsAt: visitAt,
      location: "Riverside Family Clinic, 410 Oak Street",
      notes: "Routine blood pressure and diabetes check.",
      questions: [],
      reminderEnabled: false,
      status: "completed",
      createdAt: addDays(now, -30, 9, 0),
      updatedAt: stamp,
    },
    {
      id: IDS.ruthVisit,
      patientId: IDS.ruthPatient,
      provider: "Dr. Marcus Hale",
      specialty: "Heart failure follow-up",
      startsAt: addDays(now, 1, 9, 0),
      location: "Riverside Family Clinic, 410 Oak Street",
      notes: "",
      questions: ["Should my water pill be adjusted?"],
      reminderEnabled: true,
      status: "scheduled",
      createdAt: addDays(now, -7, 9, 0),
      updatedAt: stamp,
    },
    {
      id: IDS.robertVisit,
      patientId: IDS.robertPatient,
      provider: "Dr. Marcus Hale",
      specialty: "Internal medicine",
      startsAt: addDays(now, 6, 9, 30),
      location: "Riverside Family Clinic, 410 Oak Street",
      notes: "Blood pressure check. Bring the home log.",
      questions: ["Is the morning amlodipine still the right plan?"],
      reminderEnabled: true,
      status: "scheduled",
      createdAt: addDays(now, -4, 10, 0),
      updatedAt: stamp,
    },
  ];

  const concerns: HealthConcern[] = [
    {
      id: IDS.concern,
      patientId: IDS.eleanorPatient,
      description: eleanorConcern,
      imageFileId: IDS.concernFile,
      analysis: analyzeConcernLocal({ description: eleanorConcern, hasImage: true }),
      sharedWithCareTeam: true,
      createdAt: concernAt,
      updatedAt: concernAt,
    },
    {
      id: IDS.privateConcern,
      patientId: IDS.eleanorPatient,
      description: "I have felt more tired in the afternoons this week, mostly after lunch. I am sleeping about the same.",
      imageFileId: null,
      analysis: analyzeConcernLocal({
        description: "I have felt more tired in the afternoons this week, mostly after lunch. I am sleeping about the same.",
        hasImage: false,
      }),
      sharedWithCareTeam: false,
      createdAt: privateConcernAt,
      updatedAt: privateConcernAt,
    },
    {
      id: IDS.ruthConcern,
      patientId: IDS.ruthPatient,
      description: ruthWords,
      imageFileId: null,
      analysis: analyzeConcernLocal({ description: ruthWords, hasImage: false }),
      sharedWithCareTeam: true,
      createdAt: ruthConcernAt,
      updatedAt: ruthConcernAt,
    },
  ];

  const doctorNotes: DoctorNote[] = [
    {
      id: IDS.doctorNote,
      patientId: IDS.eleanorPatient,
      doctorId: IDS.marcusDoctor,
      body: "Reviewed your note and photo about the ankle swelling. Please keep both feet raised when sitting and continue your current lisinopril as written on the label. We will look at it together at your next visit. Call the clinic if one leg becomes suddenly larger, or call 911 for chest pain or trouble breathing.",
      createdAt: noteAt,
      updatedAt: noteAt,
    },
    {
      id: IDS.ruthNote,
      patientId: IDS.ruthPatient,
      doctorId: IDS.marcusDoctor,
      body: "Please weigh yourself each morning before breakfast and write it down. Bring the list tomorrow.",
      createdAt: addDays(now, -12, 13, 0),
      updatedAt: addDays(now, -12, 13, 0),
    },
    {
      id: IDS.robertNote,
      patientId: IDS.robertPatient,
      doctorId: IDS.marcusDoctor,
      body: "Blood pressure has been steady on the current amlodipine label. Continue one 5 mg tablet every morning, as written. Bring the home log to the next visit.",
      createdAt: addDays(now, -9, 11, 0),
      updatedAt: addDays(now, -9, 11, 0),
    },
  ];

  const prescription = (id: string, medicationId: string, title: string, sourceText: string): Prescription => ({
    id,
    patientId: IDS.eleanorPatient,
    medicationId,
    title,
    sourceText,
    fileId: null,
    aiExplanation: null,
    createdAt: addDays(now, -40, 9, 0),
    updatedAt: stamp,
  });

  const event = (input: Omit<TimelineEvent, "id">): TimelineEvent => ({ id: crypto.randomUUID(), ...input });

  const timeline: TimelineEvent[] = [
    event({
      patientId: IDS.eleanorPatient,
      kind: "medication_change",
      title: "Medication added: Atorvastatin 20 mg tablet",
      summary: ATORVASTATIN,
      sourceLabel: "Entered by the patient from prescription information",
      refTable: "medications",
      refId: IDS.atorvastatin,
      createdAt: addDays(now, -40, 9, 0),
    }),
    event({
      patientId: IDS.eleanorPatient,
      kind: "appointment",
      title: "Visit with Dr. Marcus Hale",
      summary: "Routine blood pressure and diabetes check at Riverside Family Clinic.",
      sourceLabel: "Appointment saved by the patient",
      refTable: "appointments",
      refId: IDS.pastVisit,
      createdAt: visitAt,
    }),
    event({
      patientId: IDS.eleanorPatient,
      kind: "document",
      title: "Document added: After-visit summary",
      summary: "Blood pressure was reviewed. Continue lisinopril 10 mg every morning and metformin 500 mg twice a day with meals.",
      sourceLabel: "Uploaded by the patient",
      refTable: "health_documents",
      refId: IDS.visitSummary,
      createdAt: addDays(now, -18, 16, 0),
    }),
    event({
      patientId: IDS.eleanorPatient,
      kind: "medication_change",
      title: "Medication archived: Naproxen 220 mg tablet",
      summary: "The patient archived this medication. The original instructions are still saved.",
      sourceLabel: "Changed by the patient",
      refTable: "medications",
      refId: IDS.naproxen,
      createdAt: addDays(now, -17, 10, 0),
    }),
    event({
      patientId: IDS.eleanorPatient,
      kind: "concern",
      title: "Health concern: left ankle swelling",
      summary: eleanorConcern,
      sourceLabel: "Submitted by the patient. The AI response is separate from this description.",
      refTable: "health_concerns",
      refId: IDS.concern,
      createdAt: concernAt,
    }),
    event({
      patientId: IDS.eleanorPatient,
      kind: "doctor_note",
      title: "Note from Marcus Hale, MD",
      summary: doctorNotes[0].body,
      sourceLabel: "Healthcare professional note",
      refTable: "doctor_notes",
      refId: IDS.doctorNote,
      createdAt: noteAt,
    }),
    event({
      patientId: IDS.eleanorPatient,
      kind: "patient_note",
      title: "Personal note",
      summary: "Walked to the library and back on Saturday. Ankle felt better with my feet up afterward.",
      sourceLabel: "Written by the patient",
      refTable: "patient_notes",
      refId: crypto.randomUUID(),
      createdAt: addDays(now, -3, 18, 30),
    }),
    event({
      patientId: IDS.eleanorPatient,
      kind: "concern",
      title: "Health concern: afternoon tiredness",
      summary: concerns[1].description,
      sourceLabel: "Submitted by the patient. Not shared with the care team.",
      refTable: "health_concerns",
      refId: IDS.privateConcern,
      createdAt: privateConcernAt,
    }),
    event({
      patientId: IDS.eleanorPatient,
      kind: "appointment",
      title: "Eye exam booked with Dr. Priya Nair",
      summary: "Ophthalmology at Lakeside Eye Center.",
      sourceLabel: "Appointment saved by the patient",
      refTable: "appointments",
      refId: IDS.eyeVisit,
      createdAt: addDays(now, -3, 10, 0),
    }),
    event({
      patientId: IDS.ruthPatient,
      kind: "doctor_note",
      title: "Note from Marcus Hale, MD",
      summary: doctorNotes[1].body,
      sourceLabel: "Healthcare professional note",
      refTable: "doctor_notes",
      refId: IDS.ruthNote,
      createdAt: doctorNotes[1].createdAt,
    }),
    event({
      patientId: IDS.ruthPatient,
      kind: "concern",
      title: "Health concern: swelling in both ankles",
      summary: ruthWords,
      sourceLabel: "Submitted by the patient",
      refTable: "health_concerns",
      refId: IDS.ruthConcern,
      createdAt: ruthConcernAt,
    }),
    event({
      patientId: IDS.robertPatient,
      kind: "doctor_note",
      title: "Note from Marcus Hale, MD",
      summary: doctorNotes.find((note) => note.id === IDS.robertNote)?.body ?? "",
      sourceLabel: "Healthcare professional note",
      refTable: "doctor_notes",
      refId: IDS.robertNote,
      createdAt: addDays(now, -9, 11, 0),
    }),
  ];

  const db: DemoDatabase = {
    version: DEMO_VERSION,
    profiles: [
      profile(IDS.eleanorProfile, "patient", "Eleanor Walsh", "eleanor.walsh@demo.seniorhelp.test", "(555) 010-1948", stamp),
      profile(IDS.marcusProfile, "doctor", "Marcus Hale, MD", "marcus.hale@demo.seniorhelp.test", "(555) 010-4410", stamp),
      profile(IDS.helenProfile, "caregiver", "Helen Walsh", "helen.walsh@demo.seniorhelp.test", "(555) 014-2281", stamp),
      profile(IDS.arthurProfile, "patient", "Arthur Bennett", "arthur.bennett@demo.seniorhelp.test", "(555) 010-1936", stamp),
      profile(IDS.ruthProfile, "patient", "Ruth Alvarez", "ruth.alvarez@demo.seniorhelp.test", "(555) 010-1943", stamp),
      profile(IDS.robertProfile, "patient", "Robert Walsh", "robert.walsh@demo.seniorhelp.test", "(555) 010-1946", stamp),
    ],
    patients: [
      {
        id: IDS.eleanorPatient,
        profileId: IDS.eleanorProfile,
        dateOfBirth: "1948-04-12",
        address: "18 Maple Court, Riverside",
        emergencyContact: "Helen Walsh, daughter, (555) 014-2281",
        bloodType: "A+",
        allergies: "Penicillin (rash)",
        conditions: "High blood pressure. Type 2 diabetes. High cholesterol.",
        fictional: true,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: IDS.arthurPatient,
        profileId: IDS.arthurProfile,
        dateOfBirth: "1936-11-02",
        address: "9 Cedar Lane, Riverside",
        emergencyContact: "Not shared",
        bloodType: "O+",
        allergies: "None recorded",
        conditions: "Seasonal allergies",
        fictional: true,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: IDS.ruthPatient,
        profileId: IDS.ruthProfile,
        dateOfBirth: "1943-02-20",
        address: "77 Birch Street, Riverside",
        emergencyContact: "Daniel Alvarez, son, (555) 018-3302",
        bloodType: "B+",
        allergies: "Sulfa drugs (hives)",
        conditions: "Heart failure, stable. Osteoarthritis.",
        fictional: true,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: IDS.robertPatient,
        profileId: IDS.robertProfile,
        dateOfBirth: "1946-06-03",
        address: "18 Maple Court, Riverside",
        emergencyContact: "Helen Walsh, daughter, (555) 014-2281",
        bloodType: "O+",
        allergies: "None recorded",
        conditions: "High blood pressure",
        fictional: true,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    doctors: [
      {
        id: IDS.marcusDoctor,
        profileId: IDS.marcusProfile,
        specialty: "Internal medicine",
        clinic: "Riverside Family Clinic",
        fictional: true,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    caregivers: [
      {
        id: IDS.helenCaregiver,
        profileId: IDS.helenProfile,
        relationship: "Daughter",
        fictional: true,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    patientDoctors: [
      { id: IDS.doctorLink, patientId: IDS.eleanorPatient, doctorId: IDS.marcusDoctor, status: "active", authorizedAt: addDays(now, -60, 9, 0), revokedAt: null },
      { id: IDS.ruthDoctorLink, patientId: IDS.ruthPatient, doctorId: IDS.marcusDoctor, status: "active", authorizedAt: addDays(now, -90, 9, 0), revokedAt: null },
      { id: IDS.robertDoctorLink, patientId: IDS.robertPatient, doctorId: IDS.marcusDoctor, status: "active", authorizedAt: addDays(now, -30, 9, 0), revokedAt: null },
    ],
    caregiverPermissions: [
      {
        id: IDS.caregiverGrant,
        patientId: IDS.eleanorPatient,
        caregiverId: IDS.helenCaregiver,
        viewMedications: true,
        viewAppointments: true,
        viewTimeline: false,
        viewConcerns: false,
        viewReadings: true,
        manageReminders: true,
        status: "active",
        createdAt: stamp,
        updatedAt: stamp,
        revokedAt: null,
      },
      {
        id: IDS.robertGrant,
        patientId: IDS.robertPatient,
        caregiverId: IDS.helenCaregiver,
        viewMedications: true,
        viewAppointments: true,
        viewTimeline: true,
        viewConcerns: false,
        viewReadings: false,
        manageReminders: true,
        status: "active",
        createdAt: stamp,
        updatedAt: stamp,
        revokedAt: null,
      },
    ],
    medications,
    medicationEvents,
    prescriptions: [
      prescription(IDS.lisinoprilRx, IDS.lisinopril, "Lisinopril 10 mg tablet", LISINOPRIL),
      prescription(IDS.metforminRx, IDS.metformin, "Metformin 500 mg tablet", METFORMIN),
      prescription(IDS.atorvastatinRx, IDS.atorvastatin, "Atorvastatin 20 mg tablet", ATORVASTATIN),
      {
        id: IDS.amlodipineRx,
        patientId: IDS.robertPatient,
        medicationId: IDS.amlodipine,
        title: "Amlodipine 5 mg tablet",
        sourceText: AMLODIPINE,
        fileId: null,
        aiExplanation: null,
        createdAt: addDays(now, -30, 9, 0),
        updatedAt: stamp,
      },
    ],
    appointments,
    healthConcerns: concerns,
    timeline,
    documents: [
      {
        id: IDS.visitSummary,
        patientId: IDS.eleanorPatient,
        title: "After-visit summary",
        kind: "record",
        fileId: null,
        sourceText:
          "Riverside Family Clinic — after-visit summary (fictional).\nBlood pressure 128/78. A1c 6.9%.\nContinue lisinopril 10 mg every morning and metformin 500 mg twice a day with meals.\nStop naproxen. Use acetaminophen for knee pain if needed.\nReturn in 3 weeks.",
        aiExplanation: null,
        createdAt: addDays(now, -18, 16, 0),
        updatedAt: stamp,
      },
      {
        id: IDS.labResult,
        patientId: IDS.eleanorPatient,
        title: "Basic metabolic panel",
        kind: "lab",
        fileId: null,
        sourceText:
          "Sodium 139 mmol/L (135–145)\nPotassium 4.6 mmol/L (3.5–5.1)\nCreatinine 1.0 mg/dL (0.6–1.1)\neGFR 58 mL/min/1.73m² (>60) LOW\nGlucose, fasting 132 mg/dL (70–99) HIGH",
        aiExplanation: null,
        createdAt: addDays(now, -19, 8, 0),
        updatedAt: stamp,
      },
    ],
    files: [
      {
        id: IDS.concernFile,
        patientId: IDS.eleanorPatient,
        bucket: "concerns",
        fileName: "fictional-practice-photo.svg",
        mimeType: "image/svg+xml",
        bytes: practiceImage().length,
        createdAt: concernAt,
      },
      {
        id: IDS.arthurFile,
        patientId: IDS.arthurPatient,
        bucket: "documents",
        fileName: "arthur-private.txt",
        mimeType: "text/plain",
        bytes: 72,
        createdAt: stamp,
      },
    ],
    doctorNotes,
    conversations: [],
    messages: [],
    careMessages: [
      {
        id: crypto.randomUUID(),
        patientId: IDS.robertPatient,
        authorId: IDS.helenProfile,
        authorName: "Helen Walsh",
        authorRole: "caregiver",
        body: "Dad, I'll drive you to the blood pressure check and set the morning reminder for the amlodipine.",
        createdAt: addDays(now, -1, 18, 10),
      },
      {
        id: crypto.randomUUID(),
        patientId: IDS.robertPatient,
        authorId: IDS.robertProfile,
        authorName: "Robert Walsh",
        authorRole: "patient",
        body: "Thank you. The bottle is by the coffee maker.",
        createdAt: addDays(now, -1, 18, 24),
      },
      {
        id: crypto.randomUUID(),
        patientId: IDS.robertPatient,
        authorId: IDS.marcusProfile,
        authorName: "Marcus Hale, MD",
        authorRole: "doctor",
        body: "That matches the label: one 5 mg tablet every morning. Bring the home log to the visit.",
        createdAt: addDays(now, -1, 19, 5),
      },
    ],
    clinicianThreads: [],
    clinicianMessages: [],
    caregiverThreads: [],
    caregiverMessages: [],
    deviceConnections: [
      {
        id: IDS.eleanorWatch,
        patientId: IDS.eleanorPatient,
        provider: "watch",
        label: "Morning watch",
        createdAt: stamp,
      },
    ],
    deviceSecrets: [],
    readingRanges: [
      { id: IDS.heartRange, patientId: IDS.eleanorPatient, metric: "heart_rate", low: 50, high: 100 },
      { id: IDS.sleepRange, patientId: IDS.eleanorPatient, metric: "sleep_hours", low: 6, high: 9 },
    ],
    deviceReadings: [
      {
        id: IDS.heartReading,
        patientId: IDS.eleanorPatient,
        connectionId: IDS.eleanorWatch,
        metric: "heart_rate",
        value: 72,
        unit: "bpm",
        recordedAt: addDays(now, 0, 8, 10),
        status: "inside",
      },
      {
        id: IDS.sleepReading,
        patientId: IDS.eleanorPatient,
        connectionId: IDS.eleanorWatch,
        metric: "sleep_hours",
        value: 7.2,
        unit: "hours",
        recordedAt: addDays(now, 0, 7, 40),
        status: "inside",
      },
    ],
    notifications: [
      {
        id: crypto.randomUUID(),
        profileId: IDS.eleanorProfile,
        kind: "doctor_message",
        title: "Note from Dr. Hale",
        body: "Dr. Hale added a note about the ankle swelling you shared.",
        href: "/patient/timeline",
        read: false,
        createdAt: noteAt,
      },
      {
        id: crypto.randomUUID(),
        profileId: IDS.eleanorProfile,
        kind: "appointment",
        title: "Visit in 4 days",
        body: "Dr. Marcus Hale, Riverside Family Clinic.",
        href: `/patient/appointments/${IDS.upcomingVisit}`,
        read: false,
        createdAt: stamp,
      },
      {
        id: crypto.randomUUID(),
        profileId: IDS.marcusProfile,
        kind: "app",
        title: "Shared health concern",
        body: "Ruth Alvarez shared a concern about swelling in both ankles.",
        href: `/doctor/patients/${IDS.ruthPatient}`,
        read: false,
        createdAt: ruthConcernAt,
      },
      {
        id: crypto.randomUUID(),
        profileId: IDS.marcusProfile,
        kind: "app",
        title: "Shared health concern",
        body: "Eleanor Walsh shared a concern about ankle swelling.",
        href: `/doctor/patients/${IDS.eleanorPatient}`,
        read: true,
        createdAt: concernAt,
      },
      {
        id: crypto.randomUUID(),
        profileId: IDS.helenProfile,
        kind: "caregiver",
        title: "Eleanor shared access with you",
        body: "You can see medicines and appointments, and help with reminders.",
        href: `/caregiver/patients/${IDS.eleanorPatient}`,
        read: false,
        createdAt: addDays(now, -20, 12, 0),
      },
    ],
  };

  return {
    db,
    files: [
      { id: IDS.concernFile, data: practiceImage() },
      {
        id: IDS.arthurFile,
        data: Buffer.from("Fictional private document for Arthur Bennett. Other accounts must not read this.", "utf8"),
      },
    ],
  };
}
