# CRM Mágico

CRM para agentes de viajes especializados en Disney, Universal y cruceros. Cada agente tiene su propia cuenta y sus datos son solo suyos. Tiene cuatro partes:

- **CRM del agente** (`/app`): clientes, viajes con sus reservas, cotizaciones, itinerarios con IA, comisiones y más.
- **Panel de la agencia** (`/agencia`, opcional): la agencia que les paga las comisiones a sus agentes ve sus ventas y comisiones, en modo solo lectura.
- **Portal del viajero** (`/portal`): el cliente ve su viaje, el itinerario y los documentos, acepta cotizaciones y chatea con el agente.
- **Páginas públicas**: formulario de cotización (`/cotizar/CODIGO`), itinerario compartible (`/i/...`), firma de contratos (`/firmar/...`) y formularios (`/f/...`).

El vocabulario del dominio (viaje, reserva, venta, agencia…) está en [`CONTEXT.md`](CONTEXT.md). Ojo: en el código el viaje se llama `Booking` y cada reserva `BookingItem`.

## Stack

- **Next.js 16** (App Router, server actions) con **TypeScript**. El backend corre en Node dentro del mismo proyecto.
- **PostgreSQL 17** con **Prisma 7**.
- **Tailwind CSS 4**.
- **Claude** (`claude-opus-5-5`, SDK oficial `@anthropic-ai/sdk`) para itinerarios, mensajes de cotización y preguntas sobre las novedades.

## Puesta en marcha

Requisitos: Node 20.9 o superior y Docker.

```bash
npm install
npm run db:up        # levanta Postgres en Docker (puerto 5433)
cp .env.example .env # completar SESSION_SECRET, ENCRYPTION_KEY y ANTHROPIC_API_KEY
npx prisma migrate deploy
npm run db:seed      # datos de ejemplo (opcional)
npm run dev          # http://localhost:3000
```

Usuarios de ejemplo (después de `npm run db:seed`):

| Dónde | Usuario | Contraseña |
|---|---|---|
| CRM (agente de Agencia Madre Travel, administra las novedades globales) | demo@crm.test | demo1234 |
| CRM (agente de Agencia Madre Travel) | martin@crm.test | demo1234 |
| CRM (agente independiente) | paula@crm.test | demo1234 |
| Panel de Agencia Madre Travel (código de invitación `MADRE`) | agencia@crm.test | demo1234 |
| Portal del viajero | cliente@crm.test | demo1234 |
| Formulario público | `/cotizar/ENCANTADOS` | — |

`npm run db:reset` borra todo y vuelve a cargar los datos de ejemplo.

### Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a Postgres |
| `SESSION_SECRET` | Firma de las sesiones (texto aleatorio largo) |
| `ENCRYPTION_KEY` | Clave AES-256 para cifrar los accesos a MyDisney, Universal, etc. (`openssl rand -base64 32`). **No cambiarla** una vez que hay datos cifrados |
| `AI_PROVIDER` | Proveedor de IA: `anthropic` (por defecto), `groq` o `deepseek` |
| `AI_MODEL` | Opcional: otro modelo del proveedor (por defecto `claude-opus-5-5` en Anthropic, `openai/gpt-oss-120b` en Groq y `deepseek-flash` en DeepSeek; para más detalle, `deepseek-v4-pro`) |
| `ANTHROPIC_API_KEY` | API key de Anthropic, si `AI_PROVIDER` es `anthropic`. Sin la del proveedor elegido, el sistema funciona igual y la IA muestra un aviso |
| `GROQ_API_KEY` | API key de Groq, si `AI_PROVIDER` es `groq`. El plan gratuito (8.000 tokens por minuto) no alcanza para un itinerario completo |
| `DEEPSEEK_API_KEY` | API key de DeepSeek, si `AI_PROVIDER` es `deepseek` (plan prepago) |
| `APP_URL` | URL pública (links de emails, portal e iCal). En Render no hace falta: se usa `RENDER_EXTERNAL_URL` |
| `UPLOAD_DIR` | Carpeta de archivos subidos cuando no se usa R2 (por defecto `./storage/uploads`) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Archivos en Cloudflare R2. Si están, el navegador sube directo a R2 y las descargas usan links firmados que vencen en minutos |
| `SMTP_*` | Envío real de emails. Sin SMTP, los emails quedan registrados en *Plantillas de email → Últimos emails* |
| `CRON_SECRET` | Protege `/api/cron/automatizaciones` |

### Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run typecheck` | Chequeo de tipos |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Crea y aplica una migración después de cambiar `prisma/schema.prisma` |
| `npm run db:seed` / `db:reset` | Datos de ejemplo |

## Agentes y agencias

- **Cada agente es independiente.** Tiene su propio negocio (`Organization`), con un solo usuario. Sus clientes, reservas, cotizaciones y comisiones no los ve ningún otro agente.
- **Cada agente trabaja con una sola agencia**, que es la que le paga las comisiones. Hay dos casos:
  - **Agente independiente:** carga los datos de su agencia en *Configuración → Mi agencia* (nombre, contacto, email y % de comisión). Los usa para generar las planillas, mandárselas a la agencia y marcar lo que ya cobró. La agencia no tiene cuenta en la plataforma.
  - **Agencia en la plataforma:** se registra en `/registro?tipo=agencia` e invita a sus agentes con un código o un link (`/registro?agencia=CODIGO`). Un agente que ya tiene cuenta carga el código en *Mi agencia*. Desde ese momento la agencia ve, en `/agencia`, las ventas y comisiones de sus agentes: totales, detalle por agente, por mes y por destino.
- **La agencia solo lee números.** Ve código de viaje, destino, tipo y proveedor de cada reserva, fechas, montos y estado de cobro. No ve clientes, viajeros, notas ni mensajes, y no puede modificar nada. Todas sus consultas pasan por `src/lib/agency-panel.ts`.
- **Cualquiera de los dos puede cortar la relación.** El agente puede salir de la agencia y la agencia puede quitar a un agente. Los datos del agente no cambian: la agencia solo deja de verlos.

## Funcionalidades

**Clientes.** Ficha con viajeros (fecha de nacimiento, altura, alimentación, accesibilidad, vencimiento del pasaporte), preferencias para la IA (ritmo, presupuesto, intereses), etiquetas, listas inteligentes, nivel Platinum/Gold/Silver/Bronze según lo vendido, referidos, línea de tiempo y emails con plantilla. Los accesos a MyDisney, Universal y otros portales se guardan cifrados, y queda registrado cada vez que alguien ve una contraseña. Cada cliente tiene un código de invitación al portal.

**Viajes y reservas.** Un viaje es lo que vive la familia (fechas, destino, viajeros, itinerario, cotizaciones, mensajes, documentos) y se compone de varias **reservas**: por ejemplo, el paquete de Disney, los tickets de Universal, el alquiler del auto y unas noches de hotel en el centro de Orlando. Cada reserva tiene su proveedor, su confirmación, su estado (a reservar, confirmada o cancelada), sus pagos (el cliente le paga directo al proveedor: un depósito para reservar, por ejemplo USD 200 en un paquete de Disney, y después las cuotas que quiera hasta saldarla antes de la fecha límite, que en los paquetes se calcula sola 30 días antes de la llegada), su fecha de venta y su comisión, que se cobra por separado. El hotel, las entradas, Lightning Lane o el plan de comidas se cargan en la reserva que corresponde, no en el viaje. Los totales del viaje se calculan sumando sus reservas. El viaje avanza por un pipeline de 7 etapas: Consulta → Cotizado → Reservado → Pagado → Viajó → Completado, más Cancelado. La etapa se actualiza sola: Cotizado al enviar una cotización, Reservado cuando hay una reserva confirmada y Pagado cuando todas las reservas activas están confirmadas y saldadas. Si se cancela la reserva confirmada o se borra un pago, vuelve a la etapa que corresponde. Viajó, Completado y Cancelado se marcan a mano. Se ve en lista o en tablero kanban con arrastrar y soltar. Las fechas clave salen de cada reserva, con sus propias fechas: restaurantes y Lightning Lane según el check-in del paquete u hotel de Disney, el check-in online y la salida de los vuelos, el retiro del auto, el check-in del crucero y la fecha límite de pago de cada reserva sin saldar. Si una reserva queda fuera de las fechas del viaje, se avisa antes de guardarla. Los vuelos no son reservas (los agentes no los venden): en el resumen del viaje se pueden cargar, opcionalmente, la ida y la vuelta con fecha, hora, aerolínea y número, y el cliente los ve en su portal. Los tipos de reserva incluyen específicos por marca (paquete Disney World, tickets Universal, etc.) además de los genéricos. El CSV sale con una fila por reserva.

**Cotizaciones.** Varias opciones por cotización (por ejemplo, Value o Deluxe). La IA puede redactar el mensaje para el cliente. Al enviarla aparece en el portal; el cliente elige una opción y la acepta. En ese momento las reservas de esa opción se suman al viaje como "a reservar" (reemplazan a las que estaban pendientes; las ya confirmadas no se tocan) y se le crea una tarea al agente para confirmarlas con cada proveedor.

**Itinerarios.** Editor día por día: se arrastran actividades desde una paleta, se reordenan, se mueven entre días y se editan horarios, lugares y notas. La propuesta de la IA usa las edades y alturas de los viajeros, los intereses, preferencias y presupuesto del cliente, los servicios contratados, los vuelos, las notas del viaje (donde el agente anota libremente pedidos, restaurantes reservados o ideas, desde el resumen) y las novedades vigentes del destino y el catálogo de parques; el agente la revisa antes de guardar. El cliente ve el itinerario en el portal, y también se puede compartir con un link público.

**Catálogo de parques.** Atracciones (con su altura mínima), shows, restaurantes (con tipo y nivel de precio, de $ a $$$$) y shoppings que existen en cada destino, agrupados por parque o zona, con sus cierres por remodelación. Viene cargado con Walt Disney World y Universal Orlando (octubre de 2026) y lo mantienen los administradores de la plataforma, que marcan cada lugar como revisado contra la página oficial; los agentes lo consultan y pueden ver a qué atracciones no llega un chico de cierta altura. Las atracciones y shows se pueden marcar como imperdibles (vienen marcados los clásicos de cada parque). La IA arma el itinerario solo con los lugares abiertos en las fechas del viaje, según los intereses y el presupuesto, y los imperdibles que no incluya se suman solos al día de su parque. El editor de itinerarios hace una revisión automática, sea una propuesta de la IA o un itinerario armado a mano: avisa en cada actividad si algún viajero no llega a la altura mínima (con su altura cargada), si está cerrada ese día o si no figura en el catálogo, y lista los imperdibles que faltan para agregarlos con un clic. Las alturas las calcula el sistema, no la IA.

**Privacidad con la IA.** La IA nunca recibe datos que identifiquen a los viajeros: cada uno pasa como "Viajero A", "Viajero B"… con su edad, relación, alimentación y accesibilidad; no se mandan nombres, apellidos, el título del viaje ni la aerolínea y el número de vuelo (solo fecha y hora), y de los textos libres (notas, descripciones, pedidos del agente) se ocultan apellidos, emails, teléfonos y números de confirmación. Cuando vuelve la respuesta, el sistema reemplaza los alias por los nombres de pila. Las alturas tampoco se mandan: las revisa el sistema. Así se puede usar cualquier proveedor de IA sin exponer a los clientes.

**Novedades e IA.** Base de conocimiento con categoría, destinos, parque, fechas de vigencia y etiquetas. Las novedades globales las carga quien administra la plataforma (el primer usuario registrado); cada agente puede sumar las suyas, que solo ve él. La IA solo usa las publicadas y vigentes, y les da prioridad sobre lo que sabe de antes. Hay una caja para hacerle preguntas a la IA sobre las novedades.

**Comisiones.** Cada reserva confirmada es una venta: en un mismo viaje, el paquete de Disney y el auto aparecen como filas separadas, porque se cobran por separado. Se filtra por período (por fecha de venta o fin de viaje) y estado, con la opción de ver solo viajes ya realizados. Se generan planillas en Excel para la agencia del agente, que se pueden enviar por email con el adjunto o imprimir en PDF. Cada comisión se marca como cobrada con fecha y monto (también en lote), y los totales muestran lo cobrado y lo pendiente. Queda el historial de planillas. Reportes y panel de la agencia también cuentan las ventas por reserva, con cortes por proveedor y por tipo de reserva.

**Portal del viajero.** Cuenta regresiva al viaje, sus reservas con la confirmación y lo que queda por pagarle a cada proveedor (sin comisiones ni notas internas), fechas importantes, itinerario, documentos, mensajes, cotizaciones para aceptar, pedido de nuevos viajes y una ficha donde la familia carga alturas, edades y gustos.

**Mensajería.** Un hilo por cliente y viaje, más una conversación general. Bandeja con los no leídos primero, actualización automática y notificaciones.

**Otros.**
- Grupos con itinerario compartido y mensaje a todas las familias.
- Calendario mensual, con feed iCal para Google, Apple u Outlook.
- Tareas.
- Documentos por viaje y una biblioteca reutilizable, con archivos o links.
- Contratos con firma electrónica: el cliente escribe su nombre o dibuja la firma, y se registran visto, firmado e IP.
- Constructor de formularios con plantillas, link público y conversión de respuestas a clientes.
- Automatizaciones por evento o por fecha (crear tarea, enviar email, mensaje al portal, notificar), con historial de ejecuciones.
- Plantillas de email con variables.
- Reportes con gráficos.

## Publicar en Render + Cloudflare R2

El repo incluye `render.yaml` (Blueprint): app web y Postgres 17 en el plan gratis, región Virginia. Las migraciones se aplican solas al arrancar.

**1. Cloudflare R2 (archivos)**
1. En el panel de Cloudflare: *R2 Object Storage* → *Create bucket* (por ejemplo `crm-magico`).
2. En el bucket: *Settings* → *CORS Policy* → pegar (reemplazando la URL por la de Render):
   ```json
   [
     {
       "AllowedOrigins": ["https://crm-magico.onrender.com", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. *R2* → *Manage API tokens* → *Create API token* con permiso *Object Read & Write* solo sobre ese bucket. Guardar el *Access Key ID* y el *Secret Access Key* (se muestran una sola vez) y el *Account ID*.

**2. Render**
1. *New* → *Blueprint* → elegir el repo. Render lee `render.yaml`.
2. Completar las variables que pide: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` y, si la tenés, `ANTHROPIC_API_KEY`. Los secretos (`SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`) los genera Render.
3. Al terminar el despliegue, entrar a `/registro` y crear la primera cuenta (administra las novedades globales).

**Limitaciones del plan gratis:** la app se duerme tras 15 minutos sin visitas (tarda ~1 minuto en despertar) y la base Postgres gratis vence a los 30 días y se borra 14 días después si no se pasa a un plan pago (desde USD 6/mes). Antes del vencimiento conviene exportarla con `pg_dump` o pasarla a pago.

## Automatizaciones por fecha

Las automatizaciones por fecha (días antes del viaje, del pago final, de un cumpleaños, pasaporte por vencer, días después del viaje) se revisan:

- automáticamente, como mucho una vez por hora, cuando alguien abre el inicio del CRM;
- con **Ejecutar ahora** en *Automatizaciones*;
- con un cron diario: `GET /api/cron/automatizaciones` con el header `Authorization: Bearer $CRON_SECRET`.

Cada automatización se ejecuta una sola vez por viaje y por fecha. Los recordatorios de saldo salen por cada reserva con su propio vencimiento (variables `{{reservation}}` y `{{finalPaymentDue}}`; `{{pendingPayments}}` lista todos los saldos pendientes del viaje).

## Estructura

```
prisma/schema.prisma      Modelo de datos
prisma/seed.ts            Datos de ejemplo
src/lib/                  Lógica de servidor: auth, IA, automatizaciones, comisiones, emails, archivos…
src/components/           Componentes compartidos (UI, chat, editor de itinerarios, gráficos)
src/app/app/              CRM del agente
src/app/portal/           Portal del viajero
src/app/agencia/          Panel de la agencia (solo lectura)
src/app/cotizar|i|f|firmar  Páginas públicas
src/app/api/              Descarga de archivos, iCal y cron
docs/referencia/          Relevamiento de Pixie Dust CRM (features y capturas)
```
