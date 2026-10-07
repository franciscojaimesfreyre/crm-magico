// Variables {{asi}} para plantillas de email, mensajes y contratos.

export const TEMPLATE_VARIABLES = [
  { key: "clientName", label: "Nombre del cliente" },
  { key: "clientFullName", label: "Nombre y apellido del cliente" },
  { key: "agentName", label: "Nombre del agente" },
  { key: "agencyName", label: "Nombre de tu negocio" },
  { key: "tripTitle", label: "Título del viaje" },
  { key: "destination", label: "Destino" },
  { key: "tripDates", label: "Fechas del viaje" },
  { key: "startDate", label: "Fecha de inicio" },
  { key: "endDate", label: "Fecha de fin" },
  { key: "resortName", label: "Hotel / resort" },
  { key: "bookingCode", label: "Código del viaje" },
  { key: "bookingStatus", label: "Estado del viaje" },
  { key: "totalPrice", label: "Precio total del viaje" },
  { key: "reservations", label: "Lista de reservas del viaje (proveedor y confirmación)" },
  { key: "pendingPayments", label: "Saldos pendientes de cada reserva con su vencimiento" },
  { key: "reservation", label: "Reserva puntual (en recordatorios de pago)" },
  { key: "finalPaymentDue", label: "Fecha límite para saldar (de la reserva puntual o el próximo del viaje)" },
  { key: "balanceRemaining", label: "Monto que falta pagar (de la reserva puntual o el próximo del viaje)" },
  { key: "travelers", label: "Lista de viajeros" },
  { key: "portalLink", label: "Link al portal del cliente" },
  { key: "today", label: "Fecha de hoy" },
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number]["key"], string>>;

export function renderTemplate(text: string, vars: TemplateVars) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key as keyof TemplateVars];
    return value ?? match;
  });
}
