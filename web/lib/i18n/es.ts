/**
 * Spanish that ships with the site: the menus, buttons, headings, and safety lines that appear on most pages,
 * plus rules for dates, times, and counts. These are checked by a person and never sent to a translation
 * service or a model, so a button such as "Mark taken" or "Call 911" always says the same thing.
 * Anything not here (a note someone wrote, an AI explanation) goes to the translator in translate.ts.
 * Names and product names map to themselves so they are not sent anywhere.
 */
export const SPANISH: Record<string, string> = {
  // Names and product names stay as they are.
  "Senior Guardian": "Senior Guardian",
  "Eleanor Walsh": "Eleanor Walsh",
  Eleanor: "Eleanor",
  "Dr. Marcus Hale": "Dr. Marcus Hale",
  "Helen Walsh": "Helen Walsh",
  Robert: "Robert",
  "Demo1234!": "Demo1234!",

  // Navigation and page frame
  Dashboard: "Panel",
  Overview: "Resumen",
  Today: "Hoy",
  today: "hoy",
  Tomorrow: "Mañana",
  Medicines: "Medicamentos",
  "All medicines": "Todos los medicamentos",
  "Past medicines": "Medicamentos anteriores",
  Appointments: "Citas",
  Concern: "Inquietud",
  Concerns: "Inquietudes",
  "Check a concern": "Revisar una inquietud",
  "Check a Health Concern": "Revisar una inquietud de salud",
  Timeline: "Cronología",
  "My health": "Mi salud",
  Devices: "Dispositivos",
  "Care team": "Equipo de atención",
  Chat: "Chat",
  Assistant: "Asistente",
  Alerts: "Alertas",
  "Unread alerts": "Alertas sin leer",
  "See all alerts": "Ver todas las alertas",
  "You're all caught up for today.": "Está al día por hoy.",
  "No alerts today": "No hay alertas hoy",
  "Medicine reminders, visit reminders, and messages from your care team show up here on the day they arrive.":
    "Los recordatorios de medicamentos y de citas, y los mensajes de su equipo de atención, aparecen aquí el día en que llegan.",
  Settings: "Configuración",
  "Find care": "Buscar atención",
  "Find care nearby": "Buscar atención cercana",
  Patients: "Pacientes",
  Patient: "Paciente",
  "Patient records": "Expedientes de pacientes",
  Records: "Expedientes",
  Schedule: "Agenda",
  People: "Personas",
  "People I help": "Personas a las que ayudo",
  "See everyone you help": "Ver a todas las personas a las que ayuda",
  Caregiver: "Cuidador",
  Clinician: "Profesional de salud",
  Account: "Cuenta",
  Main: "Principal",
  More: "Más",
  "Open menu": "Abrir menú",
  "Skip to content": "Saltar al contenido",
  "Senior Guardian home": "Inicio de Senior Guardian",
  "Sign in": "Iniciar sesión",
  "Sign out": "Cerrar sesión",
  "Create an account": "Crear una cuenta",
  "New here?": "¿Es nuevo aquí?",
  "Forgot password?": "¿Olvidó su contraseña?",
  Email: "Correo electrónico",
  Password: "Contraseña",
  "Sample accounts": "Cuentas de ejemplo",
  "Welcome back": "Bienvenido de nuevo",
  "Good morning,": "Buenos días,",
  "Good afternoon,": "Buenas tardes,",
  "Good evening,": "Buenas noches,",

  // Common actions
  Open: "Abrir",
  Edit: "Editar",
  Review: "Revisar",
  Manage: "Administrar",
  Search: "Buscar",
  Saved: "Guardado",
  Shared: "Compartido",
  Stopped: "Suspendido",
  Offline: "Sin conexión",
  "Just now": "Justo ahora",
  "Saving…": "Guardando…",
  "Working…": "Procesando…",

  // Doses
  "Today's medicines": "Medicamentos de hoy",
  "Mark taken": "Marcar como tomada",
  Taken: "Tomada",
  Undo: "Deshacer",
  "Undoing…": "Deshaciendo…",
  "Due now": "Le toca ahora",
  Due: "Le toca",
  Later: "Más tarde",
  "Later today": "Más tarde hoy",
  "Doses taken today": "Dosis tomadas hoy",
  "doses taken": "dosis tomadas",
  "left today": "pendientes hoy",
  dose: "dosis",
  doses: "dosis",
  of: "de",
  new: "nuevas",
  was: "fue de",
  "Patient portal": "Portal del paciente",
  "Clinician portal": "Portal del profesional de salud",
  "Caregiver portal": "Portal del cuidador",
  "Marked as taken.": "Marcada como tomada.",
  "The dose is back to not taken.": "La dosis volvió a quedar como no tomada.",
  "Tap Mark taken after each dose.": "Toque Marcar como tomada después de cada dosis.",
  "All of today's medicines are marked taken. Nice work.": "Todos los medicamentos de hoy están marcados como tomados. ¡Bien hecho!",
  "Here's your day at a glance.": "Así se ve su día de un vistazo.",
  "Add a medicine": "Agregar un medicamento",
  "Add medicine": "Agregar medicamento",
  "Scan or type a label": "Escanee o escriba una etiqueta",
  "Reminders on": "Recordatorios activados",
  "Reminders off": "Recordatorios desactivados",
  "Reminder help": "Ayuda con recordatorios",
  "Your saved prescriptions, reminder times, and what you've taken today. The original label text is always kept.":
    "Sus recetas guardadas, sus horarios de recordatorio y lo que ha tomado hoy. El texto original de la etiqueta siempre se conserva.",
  "The original label stays beside every explanation": "La etiqueta original se queda junto a cada explicación",
  "Entered by the patient from prescription information": "Ingresado por el paciente con la información de la receta",
  "Recorded by the patient": "Registrado por el paciente",
  "Changed by the patient": "Cambiado por el paciente",

  // Visits
  "Next visit": "Próxima visita",
  "Upcoming visits": "Próximas visitas",
  "Visits this week": "Visitas de esta semana",
  "Coming up": "Próximamente",
  question: "pregunta",
  questions: "preguntas",

  // Concerns and the assistant
  "Latest concern": "Inquietud más reciente",
  "Shared concerns": "Inquietudes compartidas",
  "Describe it, add a photo": "Descríbala y agregue una foto",
  "Contact a clinician soon": "Comuníquese pronto con un profesional de salud",
  "Needs attention": "Necesita atención",
  "Recently shared concerns, most recent first.": "Inquietudes compartidas recientemente, de la más reciente a la más antigua.",
  "Ask the assistant": "Pregúntele al asistente",
  "Type or speak a question": "Escriba o diga una pregunta",
  "Quick assist": "Ayuda rápida",
  "Quick actions": "Acciones rápidas",
  "Quick stats": "Datos rápidos",
  "AI-powered answers come from your own saved record": "Las respuestas con IA salen de su propio expediente guardado",
  "Explain a shared medicine, visit, or note.": "Explicar un medicamento, una visita o una nota compartida.",
  "Care between visits, explained in plain language.": "Cuidado entre visitas, explicado en palabras sencillas.",
  "How to use Senior Guardian": "Cómo usar Senior Guardian",
  "Accessibility options": "Opciones de accesibilidad",

  // Record sections
  Allergies: "Alergias",
  Conditions: "Afecciones",
  "Blood type": "Tipo de sangre",
  "Emergency contact": "Contacto de emergencia",
  "Emergency information": "Información de emergencia",
  Files: "Archivos",
  "No files": "Sin archivos",
  "None shared": "Nada compartido",
  "Recent activity": "Actividad reciente",
  "Last activity": "Última actividad",
  "Last 14 days": "Últimos 14 días",
  "What you can see": "Lo que usted puede ver",
  "Your access is set by them": "Ellos definen su acceso",
  "Authorized patients": "Pacientes autorizados",
  "Search patients": "Buscar pacientes",
  "Search by name or condition": "Buscar por nombre o afección",
  "Each person chooses which sections you can see and can change it at any time.":
    "Cada persona elige qué secciones puede ver usted y puede cambiarlo en cualquier momento.",
  "Each person controls what you can see. Locked sections stay private.": "Cada persona controla lo que usted puede ver. Las secciones bloqueadas siguen siendo privadas.",
  "Here's how the people you help are doing today. You see only what each person chose to share.":
    "Así están hoy las personas a las que ayuda. Usted solo ve lo que cada persona eligió compartir.",
  "Only patients who have authorized you appear here. Concerns are visible only when the patient shares them.":
    "Aquí solo aparecen los pacientes que lo autorizaron. Las inquietudes solo se ven cuando el paciente las comparte.",
  "People who authorized you. Review status comes from the files saved on each record.":
    "Personas que lo autorizaron. El estado de revisión sale de los archivos guardados en cada expediente.",
  "You choose who sees what, and can change it any time": "Usted elige quién ve qué, y puede cambiarlo en cualquier momento",

  // Devices
  "Device readings": "Lecturas de dispositivos",
  "Device readings aren't shared with you.": "Las lecturas de dispositivos no se comparten con usted.",
  "Open devices": "Abrir dispositivos",
  "Heart rate": "Frecuencia cardiaca",
  Sleep: "Sueño",
  Steps: "Pasos",
  "Blood oxygen": "Oxígeno en la sangre",
  hours: "horas",
  bpm: "lpm",
  "A device reading is outside the saved range": "Una lectura de un dispositivo está fuera del rango guardado",
  "A number outside the saved range is a signal to look, not a diagnosis. It is sent to the person, an authorized caregiver, and an authorized clinician.":
    "Un número fuera del rango guardado es una señal para revisar, no un diagnóstico. Se envía a la persona, a un cuidador autorizado y a un profesional de salud autorizado.",
  "The latest number from a connected wearable. The circle fills as the number moves through the saved range. Halfway is a half circle.":
    "El número más reciente de un dispositivo conectado. El círculo se llena a medida que el número avanza dentro del rango guardado. A la mitad, es medio círculo.",
  ". This is a signal to look, not a diagnosis.": ". Es una señal para revisar, no un diagnóstico.",

  // Finding care
  "A pharmacy, clinic, or hospital nearby.": "Una farmacia, clínica u hospital cercano.",
  "Urgent care, pharmacies": "Atención urgente, farmacias",

  // Safety
  "Call 911": "Llame al 911",
  "Emergency? Call 911": "¿Emergencia? Llame al 911",
  "In an emergency, call 911.": "En una emergencia, llame al 911.",
  "In an emergency, call 911": "En una emergencia, llame al 911",
  "Call 911 now. Don't wait for this app.": "Llame al 911 ahora. No espere a esta aplicación.",
  ". If you feel unwell, contact a clinician. In an emergency, call 911.": ". Si se siente mal, comuníquese con un profesional de salud. En una emergencia, llame al 911.",
  "Informational only. Senior Guardian does not replace doctors, nurses, pharmacists, or emergency services. In an emergency, call 911.":
    "Solo informativo. Senior Guardian no reemplaza a médicos, enfermeras, farmacéuticos ni servicios de emergencia. En una emergencia, llame al 911.",
  "Senior Guardian is informational and does not replace your doctor, pharmacist, or emergency services. AI-powered explanations can be wrong.":
    "Senior Guardian es informativo y no reemplaza a su médico, su farmacéutico ni los servicios de emergencia. Las explicaciones con IA pueden tener errores.",

  // Settings (lib/i18n.ts settingsCopy)
  "Make the app easier to read, choose a language, and keep your contact details current.":
    "Haga que la aplicación sea más fácil de leer, elija un idioma y mantenga al día sus datos de contacto.",
  "Profile and display": "Perfil y pantalla",
  "Full name": "Nombre completo",
  Phone: "Teléfono",
  "Signed in as": "Sesión iniciada como",
  "Text size": "Tamaño del texto",
  Default: "Predeterminado",
  Large: "Grande",
  "Extra large": "Extra grande",
  "Changes the size of all text in the app after you save.": "Cambia el tamaño de todo el texto de la aplicación después de guardar.",
  Language: "Idioma",
  "Pages, menus, and buttons use the language you choose. Prescription text stays as it was saved.":
    "Las páginas, los menús y los botones usan el idioma que elija. El texto de las recetas se queda tal como se guardó.",
  "Save settings": "Guardar configuración",
  Privacy: "Privacidad",
  "Your record is visible only to you and the people listed on your care team. Every clinician and caregiver needs your explicit permission.":
    "Su expediente solo lo ven usted y las personas de su equipo de atención. Cada profesional de salud y cada cuidador necesita su permiso explícito.",
  "Senior Guardian organizes what you save and explains it with AI-powered plain language. It does not diagnose, prescribe, or replace a clinician, a pharmacist, or emergency services. In an emergency, call 911.":
    "Senior Guardian organiza lo que usted guarda y lo explica en palabras sencillas con ayuda de IA. No diagnostica, no receta ni reemplaza a un profesional de salud, a un farmacéutico ni a los servicios de emergencia. En una emergencia, llame al 911.",
  "Text size and language saved. Sample accounts keep their name and phone.": "Se guardaron el tamaño del texto y el idioma. Las cuentas de ejemplo conservan su nombre y teléfono.",
  "Settings saved.": "Configuración guardada.",

  // Sign-in page text that also appears in the help panel
  "Sign in with your email, or use one of the three sample accounts below.": "Inicie sesión con su correo electrónico o use una de las tres cuentas de ejemplo de abajo.",
  "These are sample records, not real patients. Eleanor, Dr. Hale, and Helen stay signed in while you move through the site, and each one signs out when you close the tab or go to another site. Type any email above with the password":
    "Estos son expedientes de ejemplo, no pacientes reales. Eleanor, el Dr. Hale y Helen siguen con la sesión iniciada mientras usted recorre el sitio, y cada uno cierra sesión cuando usted cierra la pestaña o va a otro sitio. Escriba cualquier correo electrónico de arriba con la contraseña",
};

const MONTHS: Record<string, string> = {
  january: "enero",
  february: "febrero",
  march: "marzo",
  april: "abril",
  may: "mayo",
  june: "junio",
  july: "julio",
  august: "agosto",
  september: "septiembre",
  october: "octubre",
  november: "noviembre",
  december: "diciembre",
};
const SHORT_MONTHS: Record<string, string> = {
  jan: "ene.",
  feb: "feb.",
  mar: "mar.",
  apr: "abr.",
  may: "may.",
  jun: "jun.",
  jul: "jul.",
  aug: "ago.",
  sep: "sept.",
  sept: "sept.",
  oct: "oct.",
  nov: "nov.",
  dec: "dic.",
};
const DAYS: Record<string, string> = {
  sunday: "domingo",
  monday: "lunes",
  tuesday: "martes",
  wednesday: "miércoles",
  thursday: "jueves",
  friday: "viernes",
  saturday: "sábado",
  sun: "dom.",
  mon: "lun.",
  tue: "mar.",
  wed: "mié.",
  thu: "jue.",
  fri: "vie.",
  sat: "sáb.",
};

const MONTH = String.raw`(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)`;
const DAY = String.raw`(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat)`;
const CLOCK = String.raw`(\d{1,2}:\d{2}) ?(AM|PM)`;

function month(name: string): string {
  const key = name.toLowerCase();
  return MONTHS[key] ?? SHORT_MONTHS[key] ?? name;
}

function clock(time: string, half: string): string {
  return `${time} ${half === "AM" ? "a. m." : "p. m."}`;
}

const RULES: Array<[RegExp, (...parts: string[]) => string]> = [
  [new RegExp(String.raw`^${CLOCK}$`), (time, half) => clock(time, half)],
  [/^In 1 day$/, () => "En 1 día"],
  [/^In (\d+) days$/, (n) => `En ${n} días`],
  [/^1 day ago$/, () => "Hace 1 día"],
  [/^(\d+) days ago$/, (n) => `Hace ${n} días`],
  [/^(\d+) min ago$/, (n) => `Hace ${n} min`],
  [/^(\d+) hr ago$/, (n) => `Hace ${n} h`],
  [/^Alerts, (\d+) unread$/, (n) => `Alertas, ${n} sin leer`],
  [/^(\d+) years old$/, (n) => `${n} años`],
  [/^Patient, (\d+)$/, (n) => `Paciente, ${n}`],
  [/^(\d+) new$/, (n) => `${n} nuevas`],
  [/^(\d+) new today$/, (n) => `${n} nuevas hoy`],
  [/^You have 1 dose left today\.$/, () => "Le queda 1 dosis hoy."],
  [/^You have (\d+) doses left today\.$/, (n) => `Le quedan ${n} dosis hoy.`],
  [/^You have 1 dose left today, and your next visit is with (.+)\.$/, (who) => `Le queda 1 dosis hoy, y su próxima visita es con ${who}.`],
  [/^You have (\d+) doses left today, and your next visit is with (.+)\.$/, (n, who) => `Le quedan ${n} dosis hoy, y su próxima visita es con ${who}.`],
  [/^Inside (\d[\d.,]*[–-]\d[\d.,]*)$/, (range) => `Dentro de ${range}`],
  [/^Outside (\d[\d.,]*[–-]\d[\d.,]*)$/, (range) => `Fuera de ${range}`],
  [new RegExp(String.raw`^Later today · can be marked from ${CLOCK}$`), (time, half) => `Más tarde hoy · se puede marcar desde las ${clock(time, half)}`],
  [/^Good (morning|afternoon|evening), (.+)$/, (part, name) => `${part === "morning" ? "Buenos días" : part === "afternoon" ? "Buenas tardes" : "Buenas noches"}, ${name}`],
  // "Wednesday, October 21, 2026"
  [new RegExp(String.raw`^${DAY}, ${MONTH} (\d{1,2}), (\d{4})$`), (day, mon, date, year) => `${DAYS[day.toLowerCase()]}, ${date} de ${month(mon)} de ${year}`],
  // "Sun, October 25 at 10:30 AM"
  [new RegExp(String.raw`^${DAY}, ${MONTH} (\d{1,2}) at ${CLOCK}$`), (day, mon, date, time, half) => `${DAYS[day.toLowerCase()]}, ${date} de ${month(mon)}, a las ${clock(time, half)}`],
  // "Oct 4, 2026", "October 4, 2026"
  [new RegExp(String.raw`^${MONTH} (\d{1,2}), (\d{4})$`), (mon, date, year) => `${date} de ${month(mon)} de ${year}`],
  // "Oct 12", "Oct"
  [new RegExp(String.raw`^${MONTH} (\d{1,2})$`), (mon, date) => `${date} de ${month(mon)}`],
  [new RegExp(String.raw`^${MONTH}$`), (mon) => month(mon)],
];

/** The built-in Spanish for this exact text, or null when it has none. */
export function builtInSpanish(text: string): string | null {
  // Own keys only: "__proto__" or "constructor" on a page must not find the object's built-in properties.
  if (Object.hasOwn(SPANISH, text)) return SPANISH[text];
  for (const [pattern, write] of RULES) {
    const match = pattern.exec(text);
    if (match) return write(...match.slice(1));
  }
  return null;
}
