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
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["value"];

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

export const FORM_TEMPLATES: { key: string; title: string; description: string; fields: FormField[] }[] = [
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
      f("¿Quiénes viajan? (nombre, edad y altura de los chicos)", "textarea", { required: true }),
      f("Restricciones alimentarias o alergias", "textarea", { mapTo: "dietaryNotes" }),
      f("Necesidades de accesibilidad", "textarea", { mapTo: "accessibilityNotes" }),
      f("¿Qué es lo que más les gusta?", "textarea", { mapTo: "preferenceNotes" }),
      f("¿Celebran algo en el viaje?", "text"),
    ],
  },
  {
    key: "survey",
    title: "¿Cómo les fue en el viaje?",
    description: "Tu opinión nos ayuda a seguir mejorando.",
    fields: [
      f("Nombre", "text", { required: true, mapTo: "firstName" }),
      f("Email", "email", { mapTo: "email" }),
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
