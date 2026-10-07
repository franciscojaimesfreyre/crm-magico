// Utilidades de viajes (sin dependencias de servidor).

type ReservationLike = { type: string; status: string; description: string };

/**
 * Alojamiento principal del viaje: la primera reserva activa de paquete, hotel o crucero.
 * El viaje no guarda el hotel; esa información vive en sus reservas.
 */
export function mainStay(items: ReservationLike[] | undefined) {
  return items?.find((i) => i.status !== "CANCELLED" && ["PACKAGE", "HOTEL", "CRUISE"].includes(i.type))?.description ?? null;
}
