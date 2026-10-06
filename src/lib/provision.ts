import "server-only";
import { db } from "@/lib/db";
import type { ActivityType, TemplateCategory, WorkflowTrigger } from "@/generated/prisma/enums";
import type { WorkflowAction, TriggerConfig } from "@/lib/automations";

const EMAIL_TEMPLATES: { key: string; name: string; category: TemplateCategory; subject: string; body: string }[] = [
  {
    key: "welcome",
    name: "Bienvenida",
    category: "WELCOME",
    subject: "¡Bienvenidos, {{clientName}}! Empezamos a planear su viaje",
    body: `Hola {{clientName}}:

¡Gracias por confiar en {{agencyName}}! Ya estoy trabajando en su viaje.

En el portal van a poder ver su itinerario, sus documentos y escribirme cuando quieran: {{portalLink}}

Cualquier duda, respondan este mail.

{{agentName}}`,
  },
  {
    key: "booked",
    name: "Viaje reservado",
    category: "CONFIRMATION",
    subject: "Su viaje {{tripTitle}} está reservado ✨",
    body: `Hola {{clientName}}:

¡Ya está! Su viaje a {{destination}} ({{tripDates}}) quedó reservado. Código: {{bookingCode}}.

Próximos pasos:
- Saldos pendientes:
{{pendingPayments}}
- En las próximas semanas les comparto el itinerario día por día en el portal: {{portalLink}}

{{agentName}}`,
  },
  {
    key: "final-payment",
    name: "Recordatorio de saldo de una reserva",
    category: "REMINDER",
    subject: "Recordatorio: vence el saldo de {{reservation}} el {{finalPaymentDue}}",
    body: `Hola {{clientName}}:

Les recuerdo que el {{finalPaymentDue}} vence el saldo de {{reservation}}, parte de su viaje {{tripTitle}}. Lo pueden pagar directamente en el portal del proveedor con su tarjeta. Si necesitan ayuda, me avisan.

{{agentName}}`,
  },
  {
    key: "final-docs",
    name: "Últimos detalles antes de viajar",
    category: "REMINDER",
    subject: "¡Falta una semana! Últimos detalles de {{tripTitle}}",
    body: `Hola {{clientName}}:

¡Ya falta muy poco! Dejé en el portal el itinerario final y todos los documentos del viaje: {{portalLink}}

Revisen pasaportes, descarguen la app oficial del parque y avísenme si quieren cambiar algo.

¡Que lo disfruten muchísimo!
{{agentName}}`,
  },
  {
    key: "review",
    name: "Pedido de reseña post-viaje",
    category: "FOLLOW_UP",
    subject: "¿Cómo les fue en {{destination}}?",
    body: `Hola {{clientName}}:

¡Bienvenidos de vuelta! Me encantaría saber cómo les fue. Si quedaron contentos, una reseña o una recomendación a amigos y familia me ayuda muchísimo.

Y cuando quieran empezar a soñar con el próximo viaje, acá estoy.

{{agentName}}`,
  },
  {
    key: "birthday",
    name: "Saludo de cumpleaños",
    category: "CUSTOM",
    subject: "¡Feliz cumpleaños! 🎉",
    body: `Hola {{clientName}}:

Les mando un saludo muy especial por el cumpleaños que se viene en la familia. ¡Que lo festejen a lo grande!

{{agentName}}`,
  },
];

type DefaultWorkflow = {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  triggerConfig: TriggerConfig;
  destinations?: ("DISNEY_WORLD" | "DISNEYLAND")[];
  actions: (WorkflowAction | { type: "SEND_EMAIL"; templateKey: string })[];
  active?: boolean;
};

const WORKFLOWS: DefaultWorkflow[] = [
  {
    name: "Bienvenida a cliente nuevo",
    description: "Email de bienvenida apenas se crea el cliente.",
    trigger: "CLIENT_CREATED",
    triggerConfig: {},
    actions: [{ type: "SEND_EMAIL", templateKey: "welcome" }],
    active: false,
  },
  {
    name: "Nueva consulta: armar cotización",
    description: "Crea una tarea para cotizar cuando entra un viaje nuevo.",
    trigger: "BOOKING_CREATED",
    triggerConfig: {},
    actions: [{ type: "CREATE_TASK", title: "Armar cotización para {{clientFullName}} ({{destination}})", priority: "HIGH", dueInDays: 2 }],
  },
  {
    name: "Viaje reservado: email al cliente",
    description: "Email al cliente cuando el viaje pasa a Reservado (primera reserva confirmada).",
    trigger: "STATUS_CHANGED",
    triggerConfig: { status: "BOOKED" },
    actions: [{ type: "SEND_EMAIL", templateKey: "booked" }],
  },
  {
    name: "Apertura de reservas de restaurantes (60 días)",
    description: "Tarea para reservar restaurantes cuando abre la ventana.",
    trigger: "DAYS_BEFORE_TRAVEL",
    triggerConfig: { days: 60 },
    destinations: ["DISNEY_WORLD", "DISNEYLAND"],
    actions: [{ type: "CREATE_TASK", title: "Reservar restaurantes para {{clientFullName}} — {{tripTitle}}", priority: "HIGH", dueInDays: 0 }],
  },
  {
    name: "Recordatorio de saldo (14 días antes, por reserva)",
    description: "Recordatorio al cliente y tarea de seguimiento.",
    trigger: "DAYS_BEFORE_FINAL_PAYMENT",
    triggerConfig: { days: 14 },
    actions: [
      { type: "SEND_EMAIL", templateKey: "final-payment" },
      { type: "CREATE_TASK", title: "Confirmar pago de {{reservation}} — {{clientFullName}}", priority: "MEDIUM", dueInDays: 10 },
    ],
  },
  {
    name: "Lightning Lane: abrir ventana (7 días)",
    description: "Tarea para reservar Lightning Lane el día que abre.",
    trigger: "DAYS_BEFORE_TRAVEL",
    triggerConfig: { days: 7 },
    destinations: ["DISNEY_WORLD", "DISNEYLAND"],
    actions: [{ type: "CREATE_TASK", title: "Reservar Lightning Lane — {{clientFullName}}", priority: "HIGH", dueInDays: 0 }],
  },
  {
    name: "Últimos detalles (7 días antes)",
    description: "Envía el email de documentos finales la semana del viaje.",
    trigger: "DAYS_BEFORE_TRAVEL",
    triggerConfig: { days: 7 },
    actions: [{ type: "SEND_EMAIL", templateKey: "final-docs" }],
  },
  {
    name: "Pasaporte por vencer",
    description: "Avisa si algún viajero tiene el pasaporte vencido o con menos de 6 meses de validez al viajar.",
    trigger: "PASSPORT_EXPIRING",
    triggerConfig: { days: 180 },
    actions: [{ type: "CREATE_TASK", title: "Revisar pasaporte de un viajero de {{clientFullName}}", priority: "HIGH", dueInDays: 1 }],
  },
  {
    name: "Pedido de reseña post-viaje",
    description: "Pide una reseña 3 días después del regreso.",
    trigger: "DAYS_AFTER_TRAVEL",
    triggerConfig: { days: 3 },
    actions: [{ type: "SEND_EMAIL", templateKey: "review" }],
  },
  {
    name: "Cobrar comisión",
    description: "Recordatorio para pedir la comisión a la agencia después del viaje.",
    trigger: "DAYS_AFTER_TRAVEL",
    triggerConfig: { days: 1 },
    actions: [{ type: "CREATE_TASK", title: "Incluir {{bookingCode}} en la próxima planilla de comisiones", priority: "MEDIUM", dueInDays: 7 }],
  },
  {
    name: "Saludo de cumpleaños",
    description: "Email una semana antes del cumpleaños de un viajero.",
    trigger: "DAYS_BEFORE_BIRTHDAY",
    triggerConfig: { days: 7 },
    actions: [{ type: "SEND_EMAIL", templateKey: "birthday" }],
    active: false,
  },
];

const ACTIVITY_TEMPLATES: { type: ActivityType; title: string; location?: string; durationMin?: number }[] = [
  { type: "PARK", title: "Magic Kingdom", location: "Walt Disney World" },
  { type: "PARK", title: "EPCOT", location: "Walt Disney World" },
  { type: "PARK", title: "Disney's Hollywood Studios", location: "Walt Disney World" },
  { type: "PARK", title: "Disney's Animal Kingdom", location: "Walt Disney World" },
  { type: "PARK", title: "Universal Studios Florida", location: "Universal Orlando" },
  { type: "PARK", title: "Islands of Adventure", location: "Universal Orlando" },
  { type: "PARK", title: "Epic Universe", location: "Universal Orlando" },
  { type: "SHOW", title: "Show de fuegos artificiales de la noche", durationMin: 20 },
  { type: "BREAK", title: "Descanso en el hotel", durationMin: 120 },
  { type: "POOL", title: "Tarde de pileta en el resort", durationMin: 180 },
  { type: "TRAVEL", title: "Traslado aeropuerto – hotel", durationMin: 60 },
  { type: "CHARACTER", title: "Encuentro con personajes", durationMin: 30 },
  { type: "SHOPPING", title: "Disney Springs", location: "Walt Disney World", durationMin: 180 },
];

const CONTRACT_BODY = `CONTRATO DE SERVICIOS DE ASESORAMIENTO DE VIAJE

Entre {{agencyName}} (en adelante, "el Agente") y {{clientFullName}} (en adelante, "el Cliente"), con fecha {{today}}, se acuerda lo siguiente:

1. OBJETO. El Agente asesora y gestiona la reserva del viaje "{{tripTitle}}" a {{destination}}, con fechas {{tripDates}}, para los viajeros: {{travelers}}.

2. PAGOS. El Cliente abona los servicios directamente a los proveedores (Disney, Universal, navieras, hoteles, rentadoras, etc.) con su propio medio de pago. El Agente no recibe ni administra fondos del Cliente.

3. CONDICIONES DE LOS PROVEEDORES. Las políticas de cambios, cancelaciones, reembolsos y depósitos son las de cada proveedor, que el Cliente declara conocer y aceptar.

4. DOCUMENTACIÓN. Es responsabilidad del Cliente contar con pasaportes vigentes, visas y cualquier documentación requerida para el viaje.

5. SEGURO. El Agente recomienda contratar un seguro de viaje con cobertura médica y de cancelación.

6. RESPONSABILIDAD. El Agente actúa como intermediario y no es responsable por incumplimientos, cierres, cambios de horarios o de atracciones decididos por los proveedores.

Firmado electrónicamente por el Cliente.`;

/** Carga plantillas, automatizaciones y actividades por defecto para una organización nueva. */
export async function provisionOrganization(organizationId: string) {
  const templateIds: Record<string, string> = {};
  for (const t of EMAIL_TEMPLATES) {
    const created = await db.emailTemplate.create({
      data: { organizationId, name: t.name, category: t.category, subject: t.subject, body: t.body },
    });
    templateIds[t.key] = created.id;
  }
  for (const w of WORKFLOWS) {
    const actions: WorkflowAction[] = w.actions.map((a) =>
      "templateKey" in a ? { type: "SEND_EMAIL", templateId: templateIds[a.templateKey] } : a,
    );
    await db.workflow.create({
      data: {
        organizationId,
        name: w.name,
        description: w.description,
        trigger: w.trigger,
        triggerConfig: w.triggerConfig,
        destinations: w.destinations ?? [],
        actions,
        active: w.active ?? true,
      },
    });
  }
  await db.activityTemplate.createMany({
    data: ACTIVITY_TEMPLATES.map((a) => ({ organizationId, ...a })),
  });
  await db.contractTemplate.create({
    data: { organizationId, name: "Contrato estándar de asesoramiento", body: CONTRACT_BODY },
  });
}
