/**
 * Spanish for the phone app's fixed labels: the tab bars and the Settings screen.
 * These ship with the app, so Spanish needs no network call. A label missing here stays in English.
 * tests/spanish.test.ts checks that every label passed to useSpanish has an entry.
 */
export const SPANISH: Record<string, string> = {
  // Tab bars
  Overview: "Resumen",
  People: "Personas",
  Reminders: "Recordatorios",
  More: "Más",
  Dashboard: "Panel",
  Patients: "Pacientes",
  Schedule: "Agenda",
  Today: "Hoy",
  Medicines: "Medicamentos",
  Visits: "Citas",

  // Settings
  Settings: "Configuración",
  "Your name, phone, language, and how large text looks in this app.": "Su nombre, teléfono, idioma y el tamaño del texto en esta aplicación.",
  "Could not save": "No se pudo guardar",
  Saved: "Guardado",
  "Your name, phone, language, and text size are updated.": "Se actualizaron su nombre, teléfono, idioma y tamaño del texto.",
  Profile: "Perfil",
  Name: "Nombre",
  Phone: "Teléfono",
  Language: "Idioma",
  "Pages, menus, and buttons use the language you choose. Prescription text stays as it was saved.":
    "Las páginas, los menús y los botones usan el idioma que elija. El texto de las recetas se queda tal como se guardó.",
  "Text size": "Tamaño del texto",
  "Applies across this app.": "Se aplica en toda la aplicación.",
  Default: "Predeterminado",
  Large: "Grande",
  Largest: "Más grande",
  "Save changes": "Guardar cambios",
  "This phone": "Este teléfono",
  "Phone alerts": "Alertas en el teléfono",
  "Phone reminders": "Recordatorios en el teléfono",
  "What rings here, and a test reminder": "Lo que suena aquí y un recordatorio de prueba",
  "Sign out": "Cerrar sesión",
  "In an emergency, call 911. Senior Guardian is not an emergency service.": "En una emergencia, llame al 911. Senior Guardian no es un servicio de emergencias.",
};
