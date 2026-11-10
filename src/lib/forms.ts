// Tipos y plantillas del constructor de formularios (compartido cliente/servidor).

export const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Teléfono" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "textarea", label: "Texto largo" },
  { value: "select", label: "Lista desplegable" },
  { value: "checkbox", label: "Casilla (sí/no)" },
  { value: "travelers", label: "Viajeros (nacimiento, altura, alergias, pasaporte)" },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["value"];

/**
 * Una fila del campo "Viajeros". Si sale de un pedido personal, viene precargada con los viajeros del
 * cliente (travelerId); las filas nuevas no lo tienen. Del pasaporte se guarda solo el vencimiento.
 */
export type TravelerAnswer = {
  travelerId?: string;
  firstName: string;
  lastName?: string;
  birthDate?: string;
  heightCm?: string;
  dietaryNotes?: string;
  accessibilityNotes?: string;
  passportExpiry?: string;
};
export const TRAVELER_FIELDS: { key: Exclude<keyof TravelerAnswer, "travelerId">; label: string; type: "text" | "date" | "number" }[] = [
  { key: "firstName", label: "Nombre", type: "text" },
  { key: "lastName", label: "Apellido", type: "text" },
  { key: "birthDate", label: "Fecha de nacimiento", type: "date" },
  { key: "heightCm", label: "Altura en cm (de los chicos, para las atracciones)", type: "number" },
  { key: "passportExpiry", label: "Vencimiento del pasaporte", type: "date" },
  { key: "dietaryNotes", label: "Alergias o restricciones alimentarias", type: "text" },
  { key: "accessibilityNotes", label: "Necesidades de accesibilidad", type: "text" },
];

export type AnswerValue = string | boolean | TravelerAnswer[];
export type Answers = Record<string, AnswerValue>;

/** Para que el teléfono complete solo nombre, email y teléfono. */
export const AUTOCOMPLETE: Partial<Record<NonNullable<FormField["mapTo"]>, string>> = {
  firstName: "given-name",
  lastName: "family-name",
  email: "email",
  phone: "tel",
  city: "address-level2",
};

/**
 * Personal: se manda a un cliente que ya existe (desde su ficha o su viaje) y no pide nombre ni email.
 * Los que piden nombre o email son para compartir con cualquiera (link público).
 */
export function isPersonalForm(fields: FormField[]) {
  return !fields.some((f) => f.mapTo === "firstName" || f.mapTo === "email");
}

/** Una respuesta como texto (para listas, notas y actividad). */
export function answerText(v: AnswerValue | undefined): string {
  if (v === undefined || v === "") return "—";
  if (v === true) return "Sí";
  if (v === false) return "No";
  if (Array.isArray(v)) return v.map((t) => [t.firstName, t.lastName].filter(Boolean).join(" ")).join(", ") || "—";
  return String(v);
}

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  /** Si se completa, al convertir la respuesta en cliente se guarda en este campo. */
  mapTo?: "firstName" | "lastName" | "email" | "phone" | "city" | "dietaryNotes" | "accessibilityNotes" | "preferenceNotes";
};

let n = 0;
const f = (label: string, type: FieldType, extra: Partial<FormField> = {}): FormField => ({
  id: `f${++n}`,
  label,
  type,
  required: false,
  ...extra,
});

/**
 * Plantillas. Las "personales" se mandan a un cliente que ya existe (desde su ficha o su viaje): no le
 * preguntan nombre ni email, porque la respuesta ya llega asociada.
 */
export const FORM_TEMPLATES: { key: string; title: string; description: string; personal?: boolean; fields: FormField[] }[] = [
  {
    key: "travelers",
    title: "Datos de los viajeros",
    description: "Completá o corregí los datos de cada viajero. Los usamos para reservar y elegir atracciones.",
    personal: true,
    fields: [f("Viajeros", "travelers", { required: true }), f("¿Algo más que tengamos que saber?", "textarea")],
  },
  {
    key: "pretrip",
    title: "Cuestionario previo al viaje",
    description: "Unas preguntas para armar el itinerario a su medida.",
    personal: true,
    fields: [
      f("¿Cuándo y cómo llegan? (vuelo, horario)", "text"),
      f("¿Celebran algo en el viaje? (cumpleaños, aniversario, primera visita)", "text"),
      f("¿Qué ritmo prefieren?", "select", { options: ["Tranquilo, con descansos", "Equilibrado", "Intenso, aprovechar todo"] }),
      f("Atracciones o experiencias que no se quieren perder", "textarea"),
      f("Restaurantes o comidas con personajes que les interesan", "textarea"),
      f("Restricciones alimentarias o alergias", "textarea", { mapTo: "dietaryNotes" }),
      f("¿Algo más que tengamos que saber?", "textarea"),
    ],
  },
  {
    key: "intake",
    title: "Ficha de la familia",
    description: "Contanos sobre ustedes para planificar un viaje a medida.",
    fields: [
      f("Nombre", "text", { required: true, mapTo: "firstName" }),
      f("Apellido", "text", { required: true, mapTo: "lastName" }),
      f("Email", "email", { required: true, mapTo: "email" }),
      f("Teléfono / WhatsApp", "phone", { mapTo: "phone" }),
      f("Ciudad", "text", { mapTo: "city" }),
      f("¿Quiénes viajan?", "travelers", { required: true }),
      f("Restricciones alimentarias o alergias", "textarea", { mapTo: "dietaryNotes" }),
      f("Necesidades de accesibilidad", "textarea", { mapTo: "accessibilityNotes" }),
      f("¿Qué es lo que más les gusta?", "textarea", { mapTo: "preferenceNotes" }),
      f("¿Celebran algo en el viaje?", "text"),
    ],
  },
  {
    key: "survey",
    title: "Encuesta post-viaje: ¿cómo les fue?",
    description: "Tu opinión nos ayuda a seguir mejorando.",
    personal: true,
    fields: [
      f("Del 1 al 10, ¿cuánto recomendarías nuestro servicio?", "select", { required: true, options: ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1"] }),
      f("¿Qué fue lo mejor del viaje?", "textarea"),
      f("¿Qué mejorarías?", "textarea"),
      f("¿Podemos publicar tu comentario como testimonio?", "checkbox"),
    ],
  },
  {
    key: "referral",
    title: "Recomendá a un amigo",
    description: "¿Conocés a alguien que sueña con Disney o Universal? Dejanos sus datos.",
    fields: [
      f("Tu nombre", "text", { required: true }),
      f("Nombre de tu amigo/a", "text", { required: true, mapTo: "firstName" }),
      f("Apellido de tu amigo/a", "text", { mapTo: "lastName" }),
      f("Email de tu amigo/a", "email", { required: true, mapTo: "email" }),
      f("Teléfono de tu amigo/a", "phone", { mapTo: "phone" }),
      f("¿Qué tipo de viaje busca?", "textarea"),
    ],
  },
  { key: "blank", title: "Formulario en blanco", description: "", fields: [f("Nombre", "text", { required: true, mapTo: "firstName" }), f("Email", "email", { required: true, mapTo: "email" })] },
];
