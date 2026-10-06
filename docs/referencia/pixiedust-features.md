# Pixie Dust CRM — Relevamiento de features

Fuente: https://pixiedustcrm.dev/features y sus 17 páginas de detalle (relevado el 2026-10-05).
Capturas de referencia en `docs/referencia/capturas/`.

Pixie Dust es un CRM para agentes de viajes especializados en Disney, Universal y cruceros. Tiene tres piezas:

1. **Web app del agente** (el CRM propiamente dicho).
2. **App móvil del cliente** (iOS/Android, gratis para el viajero): ve su viaje, itinerario, documentos y chatea con el agente.
3. **Páginas públicas**: formulario de cotización, sitio web del agente, formularios, firma de contratos, autorización de tarjeta.

Planes: Base ($10/mes), Pro, Premium, add-ons de equipo y planes para "host agencies" (agencias con varios asesores, por asiento).

---

## 0. Estructura de la web app (de las capturas)

**Barra superior:** nombre de la agencia + plan (badge "PREMIUM"), campana de notificaciones con contador, menú del usuario.

**Menú lateral:**
- Principal: Dashboard, Clients, Bookings, Groups, Calendar, Important Dates, Custom Client Branding, Tasks
- Tools: Financials, Insights, Reports, Forecasting, Dining, Promotions, Documents, Image Library, Activity Templates, Email Inbox, Marketing, Email Templates
- Abajo: Notifications, Settings

**Dashboard** (`capturas/dashboard.png`):
- Banner "Good afternoon, Dana" con fecha, nº de reservas y clientes; accesos rápidos **+ Booking**, **+ Client**, **+ Task**.
- Tarjeta "Share your lead form": código de marketing del agente (ej. `NORTHWIND`) con botones **Copy Code** / **Copy Link**.
- Accesos a My Payouts y Bookkeeping.
- **Financial Summary**: Revenue 30d, Revenue 90d, Future booked (viajes que todavía no empezaron), Commission YTD; gráfico de revenue de las últimas 12 semanas; Top clients de los últimos 90 días.
- KPIs con sparkline: Active bookings, Inquiries (esperando cotización), Pending quotes (enviadas, sin depósito), Tasks due, Clients, Active groups, Unreconciled (cheques de comisión sin conciliar).

**Ficha de cliente** (visible en `capturas/card-authorization.png`): datos de contacto (email, teléfono con badge "SMS opted in", dirección), sección **Supplier logins** (credenciales de MyDisney / navieras guardadas cifradas) y pestañas: **Trips, Plan, Prefs, History, Sends, Card auth, Notes, Activity, Communication**.

---

## 1. Gestión de clientes
`capturas/client-management.png`

- **Perfil**: nombre, email, teléfono, dirección postal; parques y resorts favoritos; restricciones alimentarias y de accesibilidad; fechas de celebración (cumpleaños, aniversarios, hitos); historial de viajes; notas libres.
- **Alta de clientes**: manual, automática desde el formulario de cotización, importación masiva desde Google Sheets. Sin límite de clientes.
- **Código de invitación** de 6 caracteres por cliente → el cliente baja la app, se registra con el código y queda vinculado al agente (ve todos sus viajes, itinerarios, documentos y mensajes).
- **Tags** (VIP, First-Timer, DVC Member, Cruise Fan, Repeat Client…).
- **Smart Lists**: filtros guardados ("Manage lists").
- **Tiering automático** por valor de vida: Platinum / Gold / Silver / Bronze.
- **Alerta de cliente en riesgo**: sin reservas por más de X tiempo (umbral configurable).
- **Listado**: búsqueda por nombre/email/teléfono/tag, "More filters", columnas Name, Advisor, Email, Phone, Tags, Trips, Last visit. Botones Insights, Import, Add client.

## 2. Reservas y pipeline
`capturas/agency-bookings.png`

- **Tipos**: Disney World, Disneyland, Universal Orlando, Disney Cruise Line, Carnival, Royal Caribbean, combinados, "Other (one-time)".
- **Formulario multipaso**:
  - Cliente, destino, fechas, tipo de viaje.
  - Alojamiento: resort, tipo de habitación (toggle "resort Disney" muestra campos condicionales).
  - Tickets y experiencias: cantidad por persona, días de parque, Lightning Lane, Memory Maker.
  - Dining: plan de comidas y reservas de restaurante.
  - Viajeros: nombre y edad de cada uno; tamaño del grupo.
  - Precio total, depósito, saldo pendiente.
- **Pipeline de 7 etapas**: Inquiry → Quoted → Deposited → Confirmed → Final Payment → Travelled → Completed (o Cancelled). Vista kanban con conteo y revenue por columna; tarjetas con cliente, destino, fechas, total.
- **Cotizaciones**: mismo detalle que una reserva + mensaje personalizado. Aparece en la app del cliente como "Pending Quote"; el cliente acepta o rechaza con un toque y el estado avanza solo. Versión imprimible.
- **Fechas clave calculadas automáticamente**:
  - Apertura de reservas de restaurantes: 60 días antes del check-in.
  - Ventana de Lightning Lane: 7 días antes de la llegada.
  - Fecha límite de pago final: configurable por reserva.
  - Se muestran en el calendario, push, app del cliente y dashboard.
- **Listado**: KPIs (total, confirmadas, cotizadas, revenue, comisión, ticket promedio); filtros por asesor, tipo, rango de fechas, búsqueda por cliente o nº de reserva; chips de estado; columnas Client (+ nº reserva), Advisor, Type, Status, Travel, Guests, Revenue, Commission, Actions; Export CSV.

## 3. Constructor de itinerarios

- Genera automáticamente una tarjeta por día según las fechas del viaje. Cada día: ubicación/parque, lista de actividades, notas.
- **Tipos de actividad**: Ride, Show, Dining, Break, Travel, Custom (con color por tipo).
- **Editor drag-and-drop** con paleta de actividades: arrastrar al día, reordenar, mover entre días.
- **Activity Templates** (menú lateral): biblioteca de actividades reutilizables.
- Cambios en tiempo real en la app del cliente; también se comparte por **link público** sin login.
- Sirve para parques, cruceros y viajes combinados.

## 4. Mensajería
`capturas/messaging.png`

- **Chat in-app**: un hilo por reserva; el cliente lo ve en la app, el agente en la web. Solo texto (los archivos van por Document Vault).
- **SMS** (Pro: número compartido, 200/mes; Premium: número dedicado, 500/mes, recargas). Inbox compartido agrupado por cliente, no leídos arriba, filtro por origen (Manual / Campaign / Drip), opt-out STOP/HELP automático. Vía Twilio con cumplimiento A2P 10DLC.
- **Notificaciones**: push al cliente y al agente; centro de notificaciones con mensajes nuevos, cotizaciones recibidas, viajes próximos, vencimientos de pago y tareas; "Mark all read".
- **Plantillas de email**: categorías Welcome, Reminder, Confirmation, Custom; variables dinámicas; se usan desde cualquier reserva con autocompletado.

## 5. Bóveda de documentos
`capturas/document-vault.png`

- Subir archivos (PDF, imágenes, DOC/DOCX, TXT; hasta 100 MB) a una reserva → aparecen al instante en la pestaña Documents del viaje del cliente.
- **Document Library**: documentos reutilizables (checklist de equipaje, comparativa de seguros, guía de Lightning Lane, welcome packet, requisitos de pasaporte, guía de embarque) que se adjuntan a cualquier reserva con un clic. Soporta **carpetas** y **links** (Canva, Google Docs). Borrar de la biblioteca no afecta copias ya adjuntadas. Hay biblioteca compartida a nivel agencia.
- **Image Library** separada.
- Cifrado en tránsito y en reposo; aislamiento por agente; el cliente solo ve/descarga.

## 6. Finanzas
- **Comisión automática** por reserva según tasa por defecto, con overrides por tipo (Disney, crucero, Universal, all-inclusive).
- Por reserva: total, depósito pagado, saldo.
- **Dashboard financiero**: revenue total, depósitos vs. saldos, comisión ganada, revenue por tipo de reserva, tendencia mensual, tabla ordenable.
- El cliente ve total/depósito/saldo, nunca la comisión.
- Exportable para el contador.

## 7. Autorización de tarjeta (CCAF)
`capturas/card-authorization.png`

- El agente crea un pedido: monto, descripción ("Final balance — Walt Disney World, Sept 22–29"), envío por email o email + SMS, opción **"autorizar hasta este monto"**.
- El cliente abre un formulario seguro, ve monto/descripción, ingresa la tarjeta (cifrada en el navegador), firma y envía.
- Ventana de 72 h para cobrar con el proveedor. El agente nunca ve el número completo.
- Se puede iniciar desde una reserva o desde el perfil del cliente (sin viaje).
- Estados: Pending, Active, Expired, Revoked; acción **Revoke**.

## 8. App móvil del cliente
`capturas/client-mobile-app.png`

- **Home**: accesos My Trip / Itinerary / Documents; banner de cotización nueva ("New Quote from Dana Whitfield — Disney Cruise Line…"); hero del viaje ("Almost there, Amanda — your trip starts Saturday", destino, fechas, adultos/niños, resort) con **cuenta regresiva** ("3 days until check-in"), botones View Itinerary / Message Advisor; botón flotante de chat.
- **Trip details**: alojamiento, tickets, reservas de restaurante, viajeros, fechas importantes, resumen de pagos.
- **Messages**, **Itinerary**, **Documents**.
- **Pedir una cotización nueva** desde la app.
- Multi-viaje (pasados y próximos).
- Branding del agente (no de Pixie Dust) en Pro/Premium.
- El cliente no ve comisiones, notas internas ni datos de otros clientes.

## 9. Formulario web de cotización
`capturas/quote-form.png`

- Campos: nombre, email, teléfono, tipo de destino, fechas (opcionales), cantidad de huéspedes, viajeros (nombre + edad, "Add traveler"), pedidos especiales.
- URL pública atada al código de marketing del agente; se comparte en web, bio de redes, QR, firma de email, grupos de Facebook.
- Al enviarse: se crea el cliente + una reserva en estado **Inquiry**, y se notifica al agente.

## 10. Email marketing
`capturas/email-marketing.png`

- Pestañas: Overview, Email, SMS, Drips, Segments.
- KPIs: campañas, emails entregados, open rate, clicks, bajas, SMS entregados.
- **Campañas de email** a un segmento: elegir plantilla, filtrar destinatarios, preview, enviar o programar. Métricas: entregas, aperturas, clicks, rebotes.
- **Campañas SMS** y **SMS drips** (secuencias multipaso con demoras, auto-inscripción desde workflows).
- **Segmentos**: filtros guardados por tags, estado de reserva, destino; se actualizan solos y muestran el conteo en vivo.
- Variables: `{{clientName}}`, `{{tripDates}}`, `{{resortName}}`, `{{destination}}`, `{{bookingStatus}}`, `{{agentName}}`.
- Gestión de bajas automática (CAN-SPAM) y lista de supresión.
- Emails individuales desde el perfil del cliente, registrados en la actividad.

## 11. Reportes personalizados
- Fuentes: Bookings, Clients, Tasks, Group Trips.
- Elegir columnas, filtros apilables (fechas, estado, destino, tags, umbrales numéricos), agrupar por cualquier campo con Count/Sum/Average.
- Vista tabla o gráfico (barras, líneas, torta).
- Plantillas: Monthly Revenue, Booking Pipeline, Commission by Type, Client Acquisition.
- Guardar, duplicar, exportar CSV y PDF.

## 12. Viajes grupales
`capturas/group-trips.png`

- Grupo con nombre, fechas, descripción, organizador, notas internas.
- Vincular reservas existentes (cada una conserva su cliente, pagos y documentos); desvincular sin perder datos.
- **Itinerario compartido** que llega a la app de todos los miembros.
- Stats: total de huéspedes, revenue, depósitos cobrados, nº de reservas. Cabinas/habitaciones.
- Mensajes broadcast a todo el grupo o individuales.
- Listado con estados Planning / Confirmed / In progress / Completed / Cancelled, búsqueda y orden.

## 13. Automatizaciones (workflows)
`capturas/workflow-automation.png`

- **Triggers**: reserva creada, cliente creado, cambio de estado, días antes del viaje / de un vencimiento, viaje terminado, cumpleaños próximo, pasaporte por vencer.
- **Acciones**: enviar email (plantilla con variables), crear tarea (título, prioridad, vencimiento relativo), inscribir en drip SMS.
- **Condiciones**: por tipo de reserva, destino o estado.
- Estados Active / Paused / Draft; vistas Analytics, Executions (log con reenvío manual en fallas), Templates.
- Ejemplos incluidos (41): recordatorio de pago final a 30 días, bienvenida a cliente nuevo, apertura de reservas de restaurante a 60 días (crea tarea), pedido de reseña post-viaje, depósito recibido → confirmación, saludo de cumpleaños 7 días antes, pasaporte por vencer en 6 meses, documentos finales 7 días antes, oferta de seguro 14 días después del depósito.

## 14. Contratos y firma electrónica
`capturas/contracts-sent.png`

- Plantillas con texto enriquecido y variables (Standard Travel Agreement, Cruise Booking Agreement, Group Travel Agreement…).
- Elegir plantilla + cliente → se genera el contrato → se envía link de firma por email.
- El cliente firma sin cuenta (firma tipeada o dibujada) desde cualquier dispositivo.
- Estados: Draft, Sent, Viewed, Signed (con timestamp); fecha de vencimiento. Se guarda en la reserva.

## 15. Constructor de formularios
- Campos: texto, email, teléfono, dropdown, fecha, textarea, checkbox, número. Requerido/opcional, reordenar, preview en vivo.
- Plantillas: intake de cliente, encuesta post-viaje, inscripción a eventos, referidos, preferencias de viaje, sorteos.
- URL pública sin login; las respuestas quedan en un visor de submissions dentro del CRM; conversión manual a cliente.

## 16. Otros del plan Base
- **Calendario** con reservas, tareas y fechas importantes; feed iCal para Google/Apple/Outlook.
- **Tareas** con prioridad y vencimiento.
- **Feed de promociones** de proveedores para compartir con clientes.
- **Importación desde Google Sheets**.

---

## Plan Pro
- **SMS** con número compartido.
- **Bookkeeping** (`capturas/bookkeeping.png`): ledger tipo Schedule C (impuestos EE.UU.). Pestañas Income / Expenses / Mileage / Reports; tarjetas Income, Expenses, Mileage (millas × tarifa IRS), Net profit. Las comisiones de reservas entran solas con badge **AUTO**. Gastos por categoría con foto del comprobante. Export CSV/PDF, comparación interanual. Vista "My books" / "Agency books".
- **Branding del portal del cliente** (`capturas/agent-website.png`): pestañas Identity, Color, Trust & Social, Voice & Copy, Trip Details; foto, nombre comercial, agencia host, tagline, logos para fondo claro y oscuro; **preview en vivo** de lo que ve el cliente.
- **Tracker de reservas de restaurantes**: confirmaciones y pedidos especiales por reserva.
- **Timeline de hitos** por reserva.
- **Gestión de promociones**: fijar, descartar, crear propias.
- **Alertas de re-engagement** (clientes que hace tiempo no reservan).
- **Referidos**: quién te manda clientes.
- **Pedido automático de reseñas** post-viaje.
- **Sitio web del agente**: página en `/a/CODIGO` con foto, bio, especialidades, hasta 6 testimonios, CTA configurable y formulario de cotización embebido; SEO y previews para redes.

## Plan Premium
- Email marketing desde **dominio propio**.
- **Número SMS dedicado** con texto bidireccional.
- **Cobros con Stripe Connect** (depósitos y pagos directo a la cuenta del agente).
- **Asistente de IA para itinerarios**: elegir destino e intereses → itinerario día por día completo en segundos.
- **Forecasting y BI**: proyecciones de revenue, estacionalidad, tasas de conversión, top clientes.
- Soporte prioritario y onboarding.

## Add-ons de equipo
- Cuentas multi-agente (invitación por código).
- Asignar y transferir reservas entre agentes.
- Dashboard de performance del equipo.
- Comisión por agente.
- Anuncios y notas internas del equipo.

## Host agencies (agencias con varios asesores)
`capturas/agency-reconciliation.png`, `capturas/commission-check-detail.png`, `capturas/advisor-payout-run.png`

- Panel de agencia con pestañas: Overview, Bookings, Pipeline, Clients, Financials, Commissions, Performance, Advisors, Recruitment, Settings.
- **Conciliación de comisiones**:
  1. Registrar el cheque del proveedor (proveedor, nº, fecha, monto). Estados: Pending, Reconciled, Accepted, Recalled.
  2. Conciliar línea por línea: esperado vs. recibido por reserva; marcar faltantes con motivo (ej. "el proveedor aplicó un descuento promocional a la base comisionable"); split asesor/agencia por línea. Acciones: **AI Parse Statement** (leer el estado de cuenta con IA), Add unclaimed line, **Accept & Lock**, Audit log. Importación desde Tern.
  3. **Liquidación a asesores**: período de pago con comisión bruta, parte de la agencia y pago a asesores; detalle por asesor y reserva; confirmación de recepción de cada asesor con reenvío de recordatorio; Export CSV.
- Reportes: ingreso proyectado, comisión ganada, vencidos; resúmenes para el formulario fiscal 1099-NEC (EE.UU.).
