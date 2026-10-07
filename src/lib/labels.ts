// Etiquetas en español para los enums. Sin dependencias de servidor: se usa en cliente y servidor.
import type {
  ActivityType,
  BookingStatus,
  BudgetLevel,
  ClientSource,
  CommissionStatus,
  ContractStatus,
  Destination,
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

export const BOOKING_STATUS_COLOR: Record<BookingStatus, string> = {
  INQUIRY: "bg-sky-100 text-sky-800",
  QUOTED: "bg-amber-100 text-amber-800",
  BOOKED: "bg-violet-100 text-violet-800",
  PAID_IN_FULL: "bg-emerald-100 text-emerald-800",
  TRAVELED: "bg-teal-100 text-teal-800",
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
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800 line-through",
};

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  DISNEY_WORLD_PACKAGE: "Paquete Disney World",
  DISNEY_WORLD_HOTEL: "Hotel Disney World",
  DISNEY_WORLD_TICKETS: "Tickets Disney World",
  DISNEYLAND_PACKAGE: "Paquete Disneyland",
  DISNEYLAND_TICKETS: "Tickets Disneyland",
  UNIVERSAL_PACKAGE: "Paquete Universal Orlando",
  UNIVERSAL_HOTEL: "Hotel Universal Orlando",
  UNIVERSAL_TICKETS: "Tickets Universal Orlando",
  UNIVERSAL_EXPRESS: "Universal Express Pass",
  DISNEY_CRUISE: "Crucero Disney Cruise Line",
  HOTEL: "Hotel",
  PACKAGE: "Paquete",
  TICKETS: "Entradas",
  CRUISE: "Crucero",
  FLIGHT: "Vuelo",
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
  DISNEYLAND_PACKAGE: "PACKAGE",
  DISNEYLAND_TICKETS: "TICKETS",
  UNIVERSAL_PACKAGE: "PACKAGE",
  UNIVERSAL_HOTEL: "HOTEL",
  UNIVERSAL_TICKETS: "TICKETS",
  UNIVERSAL_EXPRESS: "EXPERIENCE",
  DISNEY_CRUISE: "CRUISE",
  HOTEL: "HOTEL",
  PACKAGE: "PACKAGE",
  TICKETS: "TICKETS",
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
  { label: "Walt Disney World", types: ["DISNEY_WORLD_PACKAGE", "DISNEY_WORLD_HOTEL", "DISNEY_WORLD_TICKETS"] },
  { label: "Universal Orlando", types: ["UNIVERSAL_PACKAGE", "UNIVERSAL_HOTEL", "UNIVERSAL_TICKETS", "UNIVERSAL_EXPRESS"] },
  { label: "Disneyland", types: ["DISNEYLAND_PACKAGE", "DISNEYLAND_TICKETS"] },
  { label: "Cruceros", types: ["DISNEY_CRUISE", "CRUISE"] },
  { label: "Otros", types: ["PACKAGE", "HOTEL", "TICKETS", "FLIGHT", "CAR", "TRANSFER", "INSURANCE", "DINING", "EXPERIENCE", "OTHER"] },
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
  CUSTOM: "Otro",
};
export const ACTIVITY_TYPES = options(ACTIVITY_TYPE_LABEL);
export const ACTIVITY_TYPE_COLOR: Record<ActivityType, string> = {
  PARK: "border-l-violet-500 bg-violet-50",
  RIDE: "border-l-rose-500 bg-rose-50",
  SHOW: "border-l-fuchsia-500 bg-fuchsia-50",
  DINING: "border-l-amber-500 bg-amber-50",
  CHARACTER: "border-l-pink-500 bg-pink-50",
  BREAK: "border-l-emerald-500 bg-emerald-50",
  TRAVEL: "border-l-sky-500 bg-sky-50",
  SHOPPING: "border-l-orange-500 bg-orange-50",
  POOL: "border-l-cyan-500 bg-cyan-50",
  CUSTOM: "border-l-slate-400 bg-slate-50",
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
