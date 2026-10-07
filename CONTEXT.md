# Glosario del dominio

Vocabulario de CRM Mágico. Cuando el nombre en el código difiere del nombre en la interfaz, se indica entre paréntesis.

**Agente** (`Organization` + su `User`): agente de viajes que usa el CRM. Cada agente tiene su propia cuenta, con un solo usuario, y sus datos no los ve nadie más.

**Agencia** (`Agency`): la empresa que le paga las comisiones al agente. Cada agente trabaja con una sola. Puede ser una agencia cargada a mano por el agente (sin cuenta) o una agencia registrada en la plataforma, que ve en modo solo lectura los números de sus agentes.

**Cliente** (`Client`): la persona o familia que compra. Tiene **viajeros** (`Traveler`), con edad y altura, que la IA usa para planificar.

**Viaje** (`Booking`): lo que vive la familia. Tiene fechas, destino, viajeros, itinerario, cotizaciones, mensajes, documentos y un estado en el pipeline: Consulta → Cotizado → Reservado → Pagado → Viajó → Completado, más Cancelado. Sus totales (importe y comisión) son la suma de sus reservas no canceladas y no se editan a mano. Antes se llamaba "reserva" en la interfaz; las URLs viejas `/app/reservas/...` redirigen a `/app/viajes/...`.

**Reserva** (`BookingItem`): cada cosa que se reserva con un proveedor dentro de un viaje, por ejemplo un paquete de Disney, tickets de Universal, el alquiler de un auto o noches de hotel. Tiene:
- estado: a reservar (`PENDING`), confirmada (`CONFIRMED`) o cancelada (`CANCELLED`);
- proveedor, número de confirmación, fechas y detalles;
- pagos que el cliente le hace directo al proveedor, solo para seguimiento: depósito y saldo, cada uno con su vencimiento y fecha de pago;
- fecha de venta y comisión, con su propio estado de cobro.

**Venta**: una reserva confirmada. La fecha de venta se registra al confirmarla y es la que usan las planillas, los reportes y el panel de la agencia.

**Comisión**: lo que la agencia le paga al agente por cada reserva. Se calcula con el porcentaje de la reserva o, si no tiene, el de la agencia o el del agente. Su estado de cobro es Pendiente → Solicitada (incluida en una planilla) → Cobrada.

**Planilla de comisiones** (`CommissionStatement`): lista de ventas (reservas) de un período que el agente le envía a su agencia para cobrar. Cada fila es una reserva (`CommissionStatementItem.bookingItemId`).

**Cotización** (`Quote`): propuesta con una o varias **opciones** (`QuoteOption`), cada una con sus reservas cotizadas (`QuoteItem`). Cuando el cliente acepta una opción, sus reservas se suman al viaje como "a reservar".

**Fechas clave**: las aporta cada reserva según su tipo y con sus propias fechas, no las del viaje. Un paquete u hotel de Disney trae la apertura de restaurantes (60 días antes de su check-in) y de Lightning Lane (7 días antes, en Disney World); un crucero, su check-in online; un auto, el retiro y la devolución; y cada reserva sin saldar, su fecha límite de pago. El viaje suma su comienzo y su fin, y sus vuelos (check-in online y salida de la ida y la vuelta).

**Vuelos**: dato de referencia del viaje, opcional (ida y vuelta con fecha, hora, aerolínea y número). No son reservas: los agentes no los venden, así que no suman a totales, pagos ni comisiones.

**Tipo de reserva**: hay tipos específicos por marca (paquete, hotel o tickets de Disney World, Universal Orlando o Disneyland, Express Pass, crucero de Disney) y genéricos (paquete, hotel, auto…). Cada específico tiene un tipo base que define sus fechas clave y su ícono.

**Catálogo** (`CatalogEntry`): lugares que existen en un destino (atracción, show, restaurante o shopping), con parque o zona, altura mínima en pulgadas, tipo de restaurante, nivel de precio (1 a 4) y cierre temporal. Global, lo editan solo los administradores de la plataforma. Un lugar puede ser **imperdible** (`mustDo`): se suma siempre al itinerario del parque. La IA usa solo lo que figura ahí; las alturas no se le pasan: la **revisión automática** del editor (`src/lib/itinerary-checks.ts`) reconoce cada actividad por su nombre y avisa alturas, cierres, lugares fuera del catálogo e imperdibles faltantes.

**Novedad** (`KnowledgeItem`): información vigente del destino (aperturas, cierres, eventos, tips) que la IA prioriza al planificar. Puede ser global (de la plataforma) o propia del agente.
