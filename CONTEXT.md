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

**Fechas clave**: se calculan a partir del viaje y sus reservas. Incluyen la apertura de reservas de restaurantes y de Lightning Lane, según el check-in en Disney; el vencimiento del saldo de cada reserva; el check-in online del crucero; y la salida y el regreso.

**Novedad** (`KnowledgeItem`): información vigente del destino (aperturas, cierres, eventos, tips) que la IA prioriza al planificar. Puede ser global (de la plataforma) o propia del agente.
