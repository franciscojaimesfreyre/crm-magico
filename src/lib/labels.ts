// Etiquetas en español para los enums. Sin dependencias de servidor: se usa en cliente y servidor.
import type {
  ActivityType,
  BookingStatus,
  BudgetLevel,
  CatalogKind,
  ClientSource,
  CommissionStatus,
  ContractStatus,
  Destination,
  DiningStyle,
  GroupStatus,
  ItemType,
  KnowledgeCategory,
  QuoteStatus,
  ReservationStatus,
  StatementStatus,
  TaskPriority,
  TemplateCategory,
  TripPace,
  WorkflowTrigger,
} from "@/generated/prisma/enums";

type Option<T extends string> = { value: T; label: string };

function options<T extends string>(map: Record<T, string>): Option<T>[] {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }));
}

export const DESTINATION_LABEL: Record<Destination, string> = {
  DISNEY_WORLD: "Walt Disney World",
  DISNEYLAND: "Disneyland California",
  DISNEYLAND_PARIS: "Disneyland París",
  UNIVERSAL_ORLANDO: "Universal Orlando",
  UNIVERSAL_HOLLYWOOD: "Universal Hollywood",
  DISNEY_CRUISE: "Disney Cruise Line",
  OTHER_CRUISE: "Otro crucero",
  COMBINED: "Combinado",
  OTHER: "Otro",
};
export const DESTINATIONS = options(DESTINATION_LABEL);

/**
 * Color de cada destino, para reconocerlo de un vistazo (punto, talón del ticket, etiqueta).
 * dot: el color pleno; soft: el fondo pálido; ink: el texto sobre el fondo pálido (4.5:1).
 */
export const DESTINATION_TONE: Record<Destination, { dot: string; soft: string; ink: string }> = {
  DISNEY_WORLD: { dot: "bg-sky-500", soft: "bg-sky-50", ink: "text-sky-800" },
  DISNEYLAND: { dot: "bg-pink-500", soft: "bg-pink-50", ink: "text-pink-800" },
  DISNEYLAND_PARIS: { dot: "bg-blue-600", soft: "bg-blue-50", ink: "text-blue-800" },
  UNIVERSAL_ORLANDO: { dot: "bg-emerald-500", soft: "bg-emerald-50", ink: "text-emerald-800" },
  UNIVERSAL_HOLLYWOOD: { dot: "bg-lime-600", soft: "bg-lime-50", ink: "text-lime-800" },
  DISNEY_CRUISE: { dot: "bg-cyan-600", soft: "bg-cyan-50", ink: "text-cyan-800" },
  OTHER_CRUISE: { dot: "bg-cyan-400", soft: "bg-cyan-50", ink: "text-cyan-800" },
  COMBINED: { dot: "bg-amber-500", soft: "bg-amber-50", ink: "text-amber-800" },
  OTHER: { dot: "bg-slate-400", soft: "bg-slate-100", ink: "text-slate-700" },
};

/** Urgencia de algo que vence o pasa en N días: rojo atrasado, ámbar hoy y los próximos 3, turquesa la semana, neutro después. */
export function urgencyTone(days: number) {
  if (days < 0) return { soft: "bg-rose-50", ink: "text-rose-700", strong: "bg-rose-600 text-white", label: "Atrasado" };
  if (days <= 3) return { soft: "bg-amber-50", ink: "text-amber-800", strong: "bg-amber-400 text-amber-950", label: days === 0 ? "Hoy" : days === 1 ? "Mañana" : `en ${days} días` };
  if (days <= 7) return { soft: "bg-brand-50", ink: "text-brand-700", strong: "bg-brand-600 text-white", label: `en ${days} días` };
  return { soft: "bg-slate-100", ink: "text-slate-700", strong: "bg-slate-200 text-slate-800", label: `en ${days} días` };
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  INQUIRY: "Consulta",
  QUOTED: "Cotizado",
  BOOKED: "Reservado",
  PAID_IN_FULL: "Pagado",
  TRAVELED: "Viajó",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};
export const BOOKING_STATUSES = options(BOOKING_STATUS_LABEL);
/** Etapas del pipeline en orden (sin Cancelado). */
export const PIPELINE: BookingStatus[] = [
  "INQUIRY",
  "QUOTED",
  "BOOKED",
  "PAID_IN_FULL",
  "TRAVELED",
  "COMPLETED",
];

// Colores funcionales del manual: Cotizando en Menta, Confirmado (reservado) en Verde Yiorno pleno.
export const BOOKING_STATUS_COLOR: Record<BookingStatus, string> = {
  INQUIRY: "bg-sky-100 text-sky-800",
  QUOTED: "bg-brand-200 text-brand-900",
  BOOKED: "bg-brand-600 text-white",
  PAID_IN_FULL: "bg-emerald-100 text-emerald-800",
  TRAVELED: "bg-cyan-100 text-cyan-800",
  COMPLETED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-rose-100 text-rose-800",
};

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  PENDING: "Pendiente",
  REQUESTED: "Solicitada",
  PAID: "Cobrada",
};
export const COMMISSION_STATUS_COLOR: Record<CommissionStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  REQUESTED: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
};

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "A reservar",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
};
export const RESERVATION_STATUSES = options(RESERVATION_STATUS_LABEL);
export const RESERVATION_STATUS_COLOR: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-400 text-slate-900",
  CONFIRMED: "bg-brand-600 text-white",
  CANCELLED: "bg-rose-100 text-rose-800 line-through",
};

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  DISNEY_WORLD_PACKAGE: "Paquete Disney World",
  DISNEY_WORLD_HOTEL: "Hotel Disney World",
  DISNEY_WORLD_TICKETS: "Tickets Disney World",
  DISNEY_WORLD_EVENT: "Evento especial Disney World",
  DISNEYLAND_PACKAGE: "Paquete Disneyland",
  DISNEYLAND_TICKETS: "Tickets Disneyland",
  DISNEYLAND_EVENT: "Evento especial Disneyland",
  UNIVERSAL_PACKAGE: "Paquete Universal Orlando",
  UNIVERSAL_HOTEL: "Hotel Universal Orlando",
  UNIVERSAL_TICKETS: "Tickets Universal Orlando",
  UNIVERSAL_EXPRESS: "Universal Express Pass",
  UNIVERSAL_EVENT: "Evento especial Universal Orlando",
  DISNEY_CRUISE: "Crucero Disney Cruise Line",
  HOTEL: "Hotel",
  PACKAGE: "Paquete",
  TICKETS: "Entradas",
  SPECIAL_EVENT: "Ticket de evento especial",
  CRUISE: "Crucero",
  FLIGHT: "Vuelo", // ya no se ofrece: los vuelos son un dato del viaje (FlightLeg)
  CAR: "Auto",
  TRANSFER: "Traslado",
  INSURANCE: "Seguro",
  DINING: "Gastronomía",
  EXPERIENCE: "Experiencia",
  OTHER: "Otro",
};
export const ITEM_TYPES = options(ITEM_TYPE_LABEL);

/** Tipo genérico de cada tipo de reserva: define fechas clave, ícono y vencimientos. */
export const ITEM_TYPE_BASE: Record<ItemType, ItemType> = {
  DISNEY_WORLD_PACKAGE: "PACKAGE",
  DISNEY_WORLD_HOTEL: "HOTEL",
  DISNEY_WORLD_TICKETS: "TICKETS",
  DISNEY_WORLD_EVENT: "SPECIAL_EVENT",
  DISNEYLAND_PACKAGE: "PACKAGE",
  DISNEYLAND_TICKETS: "TICKETS",
  DISNEYLAND_EVENT: "SPECIAL_EVENT",
  UNIVERSAL_PACKAGE: "PACKAGE",
  UNIVERSAL_HOTEL: "HOTEL",
  UNIVERSAL_TICKETS: "TICKETS",
  UNIVERSAL_EXPRESS: "EXPERIENCE",
  UNIVERSAL_EVENT: "SPECIAL_EVENT",
  DISNEY_CRUISE: "CRUISE",
  HOTEL: "HOTEL",
  PACKAGE: "PACKAGE",
  TICKETS: "TICKETS",
  SPECIAL_EVENT: "SPECIAL_EVENT",
  CRUISE: "CRUISE",
  FLIGHT: "FLIGHT",
  CAR: "CAR",
  TRANSFER: "TRANSFER",
  INSURANCE: "INSURANCE",
  DINING: "DINING",
  EXPERIENCE: "EXPERIENCE",
  OTHER: "OTHER",
};

export type ItemBrand = "DISNEY_WORLD" | "DISNEYLAND" | "UNIVERSAL" | "DISNEY_CRUISE";

/** Marca de los tipos específicos (null en los genéricos). */
export function itemBrand(type: string): ItemBrand | null {
  if (type.startsWith("DISNEY_WORLD_")) return "DISNEY_WORLD";
  if (type.startsWith("DISNEYLAND_")) return "DISNEYLAND";
  if (type.startsWith("UNIVERSAL_")) return "UNIVERSAL";
  if (type === "DISNEY_CRUISE") return "DISNEY_CRUISE";
  return null;
}

/** Tipos agrupados para el selector (optgroups). */
export const ITEM_TYPE_GROUPS: { label: string; types: ItemType[] }[] = [
  { label: "Walt Disney World", types: ["DISNEY_WORLD_PACKAGE", "DISNEY_WORLD_HOTEL", "DISNEY_WORLD_TICKETS", "DISNEY_WORLD_EVENT"] },
  { label: "Universal Orlando", types: ["UNIVERSAL_PACKAGE", "UNIVERSAL_HOTEL", "UNIVERSAL_TICKETS", "UNIVERSAL_EXPRESS", "UNIVERSAL_EVENT"] },
  { label: "Disneyland", types: ["DISNEYLAND_PACKAGE", "DISNEYLAND_TICKETS", "DISNEYLAND_EVENT"] },
  { label: "Cruceros", types: ["DISNEY_CRUISE", "CRUISE"] },
  { label: "Otros", types: ["PACKAGE", "HOTEL", "TICKETS", "SPECIAL_EVENT", "CAR", "TRANSFER", "INSURANCE", "DINING", "EXPERIENCE", "OTHER"] },
];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
};
export const QUOTE_STATUS_COLOR: Record<QuoteStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  EXPIRED: "bg-slate-200 text-slate-500",
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  PARK: "Parque",
  RIDE: "Atracción",
  SHOW: "Show",
  DINING: "Comida",
  CHARACTER: "Personajes",
  BREAK: "Descanso",
  TRAVEL: "Traslado",
  SHOPPING: "Compras",
  POOL: "Pileta",
  CRUISE: "Crucero",
  CUSTOM: "Otro",
};
export const ACTIVITY_TYPES = options(ACTIVITY_TYPE_LABEL);
// Cuatro familias, no un color por tipo: parques y lo que se hace adentro (marca), comidas y compras
// (ámbar), descansos (verde), traslados y cruceros (celeste); lo demás, neutro.
/** Color de cada tipo de actividad (borde y fondo suave): cada tipo se reconoce de un vistazo en el itinerario. */
export const ACTIVITY_TYPE_COLOR: Record<ActivityType, string> = {
  PARK: "border-l-brand-500 bg-brand-50",
  RIDE: "border-l-violet-400 bg-violet-50/60",
  SHOW: "border-l-indigo-400 bg-indigo-50/60",
  DINING: "border-l-amber-400 bg-amber-50/70",
  CHARACTER: "border-l-rose-400 bg-rose-50/60",
  BREAK: "border-l-emerald-400 bg-emerald-50/60",
  TRAVEL: "border-l-sky-400 bg-sky-50/70",
  SHOPPING: "border-l-orange-400 bg-orange-50/60",
  POOL: "border-l-cyan-400 bg-cyan-50/60",
  CRUISE: "border-l-blue-500 bg-blue-50/60",
  CUSTOM: "border-l-slate-300 bg-slate-50",
};

export const KNOWLEDGE_CATEGORY_LABEL: Record<KnowledgeCategory, string> = {
  NEWS: "Novedad",
  OPENING: "Apertura",
  CLOSURE: "Cierre",
  REFURBISHMENT: "Remodelación",
  EVENT: "Evento",
  PROMOTION: "Promoción",
  ATTRACTION: "Atracción",
  DINING: "Gastronomía",
  TIP: "Tip",
  RULE_CHANGE: "Cambio de reglas",
  PRICING: "Precios",
};
export const KNOWLEDGE_CATEGORIES = options(KNOWLEDGE_CATEGORY_LABEL);

/** Color de cada categoría de novedad: lo que cierra en rojo, lo que abre en verde, eventos en violeta, plata en ámbar. */
export const KNOWLEDGE_CATEGORY_COLOR: Record<KnowledgeCategory, string> = {
  NEWS: "bg-sky-50 text-sky-800",
  OPENING: "bg-emerald-50 text-emerald-800",
  CLOSURE: "bg-rose-50 text-rose-700",
  REFURBISHMENT: "bg-orange-50 text-orange-800",
  EVENT: "bg-violet-50 text-violet-800",
  PROMOTION: "bg-amber-50 text-amber-800",
  ATTRACTION: "bg-cyan-50 text-cyan-800",
  DINING: "bg-pink-50 text-pink-800",
  TIP: "bg-brand-50 text-brand-700",
  RULE_CHANGE: "bg-slate-100 text-slate-700",
  PRICING: "bg-amber-50 text-amber-800",
};

export const TRIP_PACE_LABEL: Record<TripPace, string> = {
  RELAXED: "Relajado",
  MODERATE: "Moderado",
  INTENSE: "Intenso (de apertura a cierre)",
};
export const TRIP_PACES = options(TRIP_PACE_LABEL);

export const BUDGET_LEVEL_LABEL: Record<BudgetLevel, string> = {
  VALUE: "Económico",
  MODERATE: "Moderado",
  DELUXE: "Deluxe",
  LUXURY: "Lujo",
};
export const BUDGET_LEVELS = options(BUDGET_LEVEL_LABEL);

export const CATALOG_KIND_LABEL: Record<CatalogKind, string> = {
  ATTRACTION: "Atracción",
  SHOW: "Show",
  RESTAURANT: "Restaurante",
  SHOPPING: "Shopping",
};
export const CATALOG_KINDS = options(CATALOG_KIND_LABEL);
export const CATALOG_KIND_COLOR: Record<CatalogKind, string> = {
  ATTRACTION: "bg-brand-100 text-brand-800",
  SHOW: "bg-slate-100 text-slate-700",
  RESTAURANT: "bg-amber-50 text-amber-800",
  SHOPPING: "bg-sky-50 text-sky-700",
};

export const DINING_STYLE_LABEL: Record<DiningStyle, string> = {
  TABLE_SERVICE: "Servicio a la mesa",
  QUICK_SERVICE: "Comida rápida",
  CHARACTER_DINING: "Con personajes",
  SIGNATURE: "Gourmet",
  LOUNGE: "Bar",
  SNACK: "Snacks",
};
export const DINING_STYLES = options(DINING_STYLE_LABEL);

/** Nivel de precio de restaurantes y shoppings (1 a 4). */
export const PRICE_LEVELS = [
  { value: "1", label: "$ · Barato" },
  { value: "2", label: "$$ · Moderado" },
  { value: "3", label: "$$$ · Caro" },
  { value: "4", label: "$$$$ · Muy caro" },
];
export const priceSigns = (level: number | null | undefined) => (level ? "$".repeat(level) : "");

export const CLIENT_SOURCE_LABEL: Record<ClientSource, string> = {
  MANUAL: "Carga manual",
  QUOTE_FORM: "Formulario web",
  PORTAL: "Portal",
  IMPORT: "Importación",
  REFERRAL: "Referido",
};

export const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  PLANNING: "Planificando",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};
export const GROUP_STATUSES = options(GROUP_STATUS_LABEL);

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};
export const TASK_PRIORITIES = options(TASK_PRIORITY_LABEL);

export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  WELCOME: "Bienvenida",
  REMINDER: "Recordatorio",
  CONFIRMATION: "Confirmación",
  FOLLOW_UP: "Seguimiento",
  CUSTOM: "Otra",
};
export const TEMPLATE_CATEGORIES = options(TEMPLATE_CATEGORY_LABEL);

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  VIEWED: "Visto",
  SIGNED: "Firmado",
};
export const CONTRACT_STATUS_COLOR: Record<ContractStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-800",
  VIEWED: "bg-amber-100 text-amber-800",
  SIGNED: "bg-emerald-100 text-emerald-800",
};

export const STATEMENT_STATUS_LABEL: Record<StatementStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  PARTIALLY_PAID: "Cobrada en parte",
  PAID: "Cobrada",
};

export const WORKFLOW_TRIGGER_LABEL: Record<WorkflowTrigger, string> = {
  BOOKING_CREATED: "Se crea una reserva",
  CLIENT_CREATED: "Se crea un cliente",
  STATUS_CHANGED: "La reserva cambia de estado",
  DAYS_BEFORE_TRAVEL: "Días antes del viaje",
  DAYS_AFTER_TRAVEL: "Días después del viaje",
  DAYS_BEFORE_FINAL_PAYMENT: "Días antes del pago final",
  DAYS_BEFORE_BIRTHDAY: "Días antes de un cumpleaños",
  PASSPORT_EXPIRING: "Pasaporte por vencer",
};
export const WORKFLOW_TRIGGERS = options(WORKFLOW_TRIGGER_LABEL);
