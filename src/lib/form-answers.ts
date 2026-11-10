import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { logActivity, notifyClient, notifyStaff } from "@/lib/events";
import { addDays, ageOn, formatDate, parseDateInput, todayUTC } from "@/lib/format";
import { FORM_TEMPLATES, TRAVELER_FIELDS, answerText, isPersonalForm, type Answers, type FormField, type TravelerAnswer } from "@/lib/forms";

/*
 * Formularios pedidos a un cliente: el agente los manda desde la ficha del cliente o desde el viaje con un
 * link personal; la respuesta llega asociada y el agente la revisa antes de pasarla a la ficha y a los
 * viajeros (nunca se aplica sola, y nunca pisa lo que el agente ya cargó).
 */

export const formRequestUrl = (token: string) => `${appUrl()}/formulario/${token}`;

/** Días que vale un link personal (después hay que pedir uno nuevo). */
export const FORM_LINK_DAYS = 45;
export const formLinkExpired = (sentAt: Date) => Date.now() - sentAt.getTime() > FORM_LINK_DAYS * 86400_000;
/** Token largo y aleatorio: el link muestra datos de los viajeros, no tiene que poder adivinarse. */
const newToken = () => randomBytes(24).toString("base64url");

const clean = (v: FormDataEntryValue | null, max = 5000) => String(v ?? "").trim().slice(0, max);

/** Lee las respuestas del formulario enviado, validando según cada campo. */
export function parseAnswers(fields: FormField[], formData: FormData): { data: Answers } | { error: string } {
  const data: Answers = {};
  for (const f of fields) {
    if (f.type === "checkbox") {
      data[f.id] = formData.get(f.id) === "on";
      continue;
    }
    if (f.type === "travelers") {
      const count = Math.min(Number(formData.get(`${f.id}__count`)) || 0, 20);
      const rows: TravelerAnswer[] = [];
      for (let i = 0; i < count; i++) {
        const get = (k: string) => clean(formData.get(`${f.id}__${i}__${k}`), 300);
        const row: TravelerAnswer = { firstName: get("firstName") };
        const travelerId = get("travelerId");
        if (travelerId) row.travelerId = travelerId;
        for (const t of TRAVELER_FIELDS) if (t.key !== "firstName" && get(t.key)) row[t.key] = get(t.key);
        const name = row.firstName || `el viajero ${i + 1}`;
        if (row.heightCm && !(Number(row.heightCm) >= 30 && Number(row.heightCm) <= 250)) return { error: `Revisá la altura de ${name}: va en centímetros (por ejemplo, 118).` };
        if (row.birthDate && !(row.birthDate >= "1900-01-01" && row.birthDate <= new Date().toISOString().slice(0, 10))) return { error: `Revisá la fecha de nacimiento de ${name}.` };
        if (row.passportExpiry && !(row.passportExpiry >= "2000-01-01" && row.passportExpiry <= "2100-01-01")) return { error: `Revisá el vencimiento del pasaporte de ${name}.` };
        if (!row.firstName) {
          if (Object.keys(row).length > 1) return { error: `Falta el nombre de un viajero en: ${f.label}` };
          continue; // fila vacía
        }
        rows.push(row);
      }
      if (f.required && rows.length === 0) return { error: `Agregá al menos un viajero en: ${f.label}` };
      data[f.id] = rows;
      continue;
    }
    const value = clean(formData.get(f.id));
    if (f.required && !value) return { error: `Completá: ${f.label}` };
    if (f.type === "email" && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return { error: `Email inválido en: ${f.label}` };
    if (f.type === "select" && value && f.options && !f.options.includes(value)) return { error: `Opción inválida en: ${f.label}` };
    data[f.id] = value;
  }
  return { data };
}

/** Quién respondió, según los campos de nombre (para el aviso de una respuesta anónima). */
export function respondentName(fields: FormField[], data: Answers) {
  const get = (k: FormField["mapTo"]) => {
    const f = fields.find((x) => x.mapTo === k);
    const v = f ? data[f.id] : undefined;
    return typeof v === "string" ? v : "";
  };
  return [get("firstName"), get("lastName")].filter(Boolean).join(" ");
}

/**
 * El formulario de una plantilla para la agencia: el que ya existe (el de viajeros, por su campo; los demás,
 * por el título) o uno nuevo creado desde la plantilla.
 */
export async function formFromTemplate(organizationId: string, marketingCode: string, key: string) {
  const t = FORM_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error("Plantilla no encontrada");
  const forms = await db.form.findMany({ where: { organizationId, active: true }, orderBy: { createdAt: "asc" } });
  const existing =
    key === "travelers"
      ? forms.find((f) => (f.fields as FormField[]).some((x) => x.type === "travelers") && isPersonalForm(f.fields as FormField[]))
      : forms.find((f) => f.title === t.title);
  if (existing) return existing;
  return db.form.create({
    data: {
      organizationId,
      title: t.title,
      description: t.description,
      fields: t.fields,
      slug: `${marketingCode.toLowerCase()}-${randomBytes(4).toString("hex")}`,
    },
  });
}

export const travelersForm = (organizationId: string, marketingCode: string) => formFromTemplate(organizationId, marketingCode, "travelers");

/** Pide un formulario a un cliente (y a un viaje): link personal, aviso en el portal y, si se pide, email. */
export async function createFormRequest(input: { organizationId: string; formId: string; clientId: string; bookingId?: string | null; userId?: string | null; email: boolean }) {
  const [form, client, booking, org] = await Promise.all([
    db.form.findFirstOrThrow({ where: { id: input.formId, organizationId: input.organizationId } }),
    db.client.findFirstOrThrow({ where: { id: input.clientId, organizationId: input.organizationId } }),
    input.bookingId ? db.booking.findFirst({ where: { id: input.bookingId, organizationId: input.organizationId } }) : null,
    db.organization.findUniqueOrThrow({ where: { id: input.organizationId } }),
  ]);
  const request = await db.formRequest.create({
    data: { organizationId: input.organizationId, formId: form.id, clientId: client.id, bookingId: booking?.id ?? null, sentById: input.userId ?? null, token: newToken() },
  });
  const url = formRequestUrl(request.token);
  await notifyClient({
    organizationId: input.organizationId,
    clientId: client.id,
    title: `Tenés un formulario para completar: ${form.title}`,
    body: booking ? booking.title : undefined,
    link: `/formulario/${request.token}`,
  });
  let emailed = false;
  if (input.email && client.email) {
    const result = await sendEmail({
      organizationId: input.organizationId,
      to: client.email,
      subject: `${form.title}${booking ? ` · ${booking.title}` : ""}`,
      body: `Hola ${client.firstName}:\n\n${form.description ?? "Te pedimos que completes este formulario."}\n\nCompletalo acá: ${url}\n\nGracias,\n${org.name}`,
      clientId: client.id,
      bookingId: booking?.id,
    });
    emailed = result.status !== "FAILED";
  }
  await logActivity({
    organizationId: input.organizationId,
    clientId: client.id,
    bookingId: booking?.id,
    userId: input.userId ?? null,
    type: "form",
    description: `Formulario enviado: ${form.title}${emailed ? " (por email)" : ""}`,
  });
  return { request, url, emailed };
}

/** Recordatorio único de los formularios pedidos hace 5 días o más que siguen sin respuesta. */
export async function remindFormRequests(organizationId: string) {
  const pending = await db.formRequest.findMany({
    where: { organizationId, status: { not: "ANSWERED" }, remindedAt: null, sentAt: { lt: new Date(Date.now() - 5 * 86400_000) } },
    include: { form: true, client: true, booking: { select: { code: true, agentId: true } } },
  });
  for (const r of pending) {
    await notifyClient({ organizationId, clientId: r.clientId, title: `Recordatorio: falta completar "${r.form.title}"`, link: `/formulario/${r.token}` });
    if (r.client.email) {
      await sendEmail({
        organizationId,
        to: r.client.email,
        subject: `Recordatorio: ${r.form.title}`,
        body: `Hola ${r.client.firstName}:\n\nTodavía falta completar "${r.form.title}". Te lleva unos minutos: ${formRequestUrl(r.token)}\n\n¡Gracias!`,
        clientId: r.clientId,
        bookingId: r.bookingId,
      });
    }
    await notifyStaff({
      organizationId,
      userId: r.booking?.agentId ?? r.client.ownerId ?? null,
      title: `${r.client.firstName} ${r.client.lastName} no respondió "${r.form.title}" (se le recordó)`,
      link: r.bookingId ? `/app/viajes/${r.bookingId}` : `/app/clientes/${r.clientId}?tab=formularios`,
    });
    await db.formRequest.update({ where: { id: r.id }, data: { remindedAt: new Date() } });
  }
  return pending.length;
}

// ─── Revisar y aplicar ───────────────────────────────────────────────────────

type TravelerRow = { id: string; firstName: string; lastName: string | null; birthDate: Date | null; heightCm: number | null; dietaryNotes: string | null; accessibilityNotes: string | null; passportExpiry: Date | null };

/** Valor actual de un viajero como texto, para comparar con lo que respondió el cliente. */
function currentValue(t: TravelerRow | undefined, key: (typeof TRAVELER_FIELDS)[number]["key"]) {
  if (!t) return "";
  const v = t[key];
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v === null || v === undefined ? "" : String(v);
}

export type TravelerChange = { key: string; name: string; travelerId?: string; isNew: boolean; changes: { key: string; label: string; from: string; to: string }[] };

/**
 * Cómo quedaría cada viajero si se aplica la respuesta (solo lo que cambia). Cada cambio tiene su clave
 * (fila:campo; la fila de un viajero nuevo, fila:new) para que el agente elija cuáles aplicar.
 */
export function travelerChanges(rows: TravelerAnswer[], current: TravelerRow[], fieldId = "t"): TravelerChange[] {
  return rows.map((row, i) => {
    const rowKey = `${fieldId}:${i}`;
    const t = row.travelerId ? current.find((x) => x.id === row.travelerId) : current.find((x) => x.firstName.toLowerCase() === row.firstName.toLowerCase() && (x.lastName ?? "").toLowerCase() === (row.lastName ?? "").toLowerCase());
    const changes = TRAVELER_FIELDS.filter((f) => row[f.key] && row[f.key] !== currentValue(t, f.key)).map((f) => {
      const show = (v: string) => (v && f.type === "date" ? formatDate(new Date(`${v}T00:00:00Z`)) : v || "—");
      return { key: `${rowKey}:${f.key}`, label: f.label, from: show(currentValue(t, f.key)), to: show(row[f.key]!) };
    });
    return { key: rowKey, name: [row.firstName, row.lastName].filter(Boolean).join(" "), travelerId: t?.id, isNew: !t, changes };
  });
}

/** Suma texto a una nota sin perder lo anterior. */
const appendNote = (current: string | null, next: string | undefined) => (!next ? current : !current ? next : current.includes(next) ? current : `${current}\n${next}`);

/**
 * Pasa una respuesta a la ficha: completa los datos del cliente que estaban vacíos (las notas se suman),
 * actualiza o crea los viajeros (y suma los nuevos al viaje) y deja el resto de las respuestas en las notas
 * del viaje, que usa la IA para el itinerario (o en la actividad del cliente, si no hay viaje).
 */
export async function applySubmission(submissionId: string, organizationId: string, userId: string, selected?: Set<string>) {
  const sub = await db.formSubmission.findFirst({ where: { id: submissionId, form: { organizationId } }, include: { form: true } });
  if (!sub?.clientId) return { error: "La respuesta todavía no está asociada a un cliente" };
  const client = await db.client.findUniqueOrThrow({ where: { id: sub.clientId }, include: { travelers: true } });
  const fields = sub.form.fields as FormField[];
  const data = (sub.data ?? {}) as Answers;

  // Datos del cliente: solo lo vacío; las notas se suman.
  const mapped: Record<string, string> = {};
  for (const f of fields) {
    const v = data[f.id];
    if (f.mapTo && typeof v === "string" && v.trim()) mapped[f.mapTo] = v.trim();
  }
  await db.client.update({
    where: { id: client.id },
    data: {
      phone: client.phone || mapped.phone || null,
      city: client.city || mapped.city || null,
      email: client.email || mapped.email?.toLowerCase() || null,
      dietaryNotes: appendNote(client.dietaryNotes, mapped.dietaryNotes),
      accessibilityNotes: appendNote(client.accessibilityNotes, mapped.accessibilityNotes),
      preferenceNotes: appendNote(client.preferenceNotes, mapped.preferenceNotes),
    },
  });

  // Viajeros: lo que responde el cliente sobre sus viajeros es la fuente; las notas se suman.
  let created = 0;
  let updated = 0;
  for (const f of fields.filter((x) => x.type === "travelers")) {
    const rows = (Array.isArray(data[f.id]) ? data[f.id] : []) as TravelerAnswer[];
    const changes = travelerChanges(rows, client.travelers, f.id);
    for (const [i, change] of changes.entries()) {
      const row = rows[i];
      // Sin selección se aplica todo; con selección, solo los cambios marcados.
      const pick = (k: string) => !selected || selected.has(`${change.key}:${k}`);
      const height = Number(row.heightCm);
      const values = {
        firstName: row.firstName,
        lastName: row.lastName || undefined,
        birthDate: parseDateInput(row.birthDate ?? null) ?? undefined,
        heightCm: Number.isFinite(height) && height > 0 ? Math.round(height) : undefined,
        passportExpiry: parseDateInput(row.passportExpiry ?? null) ?? undefined,
      };
      if (change.travelerId) {
        const chosen = change.changes.filter((c) => pick(c.key.split(":").pop()!));
        if (chosen.length === 0) continue;
        const t = client.travelers.find((x) => x.id === change.travelerId)!;
        const has = (k: string) => chosen.some((c) => c.key.endsWith(`:${k}`));
        await db.traveler.update({
          where: { id: t.id },
          data: {
            firstName: has("firstName") ? values.firstName : undefined,
            lastName: has("lastName") ? values.lastName : undefined,
            birthDate: has("birthDate") ? values.birthDate : undefined,
            heightCm: has("heightCm") ? values.heightCm : undefined,
            passportExpiry: has("passportExpiry") ? values.passportExpiry : undefined,
            dietaryNotes: has("dietaryNotes") ? appendNote(t.dietaryNotes, row.dietaryNotes) : undefined,
            accessibilityNotes: has("accessibilityNotes") ? appendNote(t.accessibilityNotes, row.accessibilityNotes) : undefined,
          },
        });
        updated++;
      } else {
        if (!pick("new")) continue;
        const t = await db.traveler.create({
          data: { clientId: client.id, ...values, dietaryNotes: row.dietaryNotes || null, accessibilityNotes: row.accessibilityNotes || null },
        });
        created++;
        if (sub.bookingId) await db.bookingTraveler.create({ data: { bookingId: sub.bookingId, travelerId: t.id } }).catch(() => null);
      }
    }
  }

  // El resto de las respuestas: a las notas del viaje (las lee la IA) o a la actividad del cliente.
  const rest = fields
    .filter((f) => !f.mapTo && f.type !== "travelers" && data[f.id] !== undefined && data[f.id] !== "" && data[f.id] !== false)
    .map((f) => `${f.label}: ${answerText(data[f.id])}`);
  if (rest.length && sub.bookingId) {
    const booking = await db.booking.findUniqueOrThrow({ where: { id: sub.bookingId }, select: { notes: true } });
    const block = `${sub.form.title} (${formatDate(sub.createdAt)}):\n${rest.map((r) => `- ${r}`).join("\n")}`;
    await db.booking.update({ where: { id: sub.bookingId }, data: { notes: appendNote(booking.notes, block) } });
  }
  await db.formSubmission.update({ where: { id: sub.id }, data: { appliedAt: new Date() } });
  const parts = [created && `${created} viajero${created === 1 ? "" : "s"} nuevo${created === 1 ? "" : "s"}`, updated && `${updated} actualizado${updated === 1 ? "" : "s"}`].filter(Boolean);
  await logActivity({
    organizationId,
    clientId: client.id,
    bookingId: sub.bookingId,
    userId,
    type: "form",
    description: `Respuestas de "${sub.form.title}" pasadas a la ficha${parts.length ? `: ${parts.join(", ")}` : ""}${rest.length && !sub.bookingId ? ` — ${rest.join(" · ")}` : ""}`,
  });
  return { ok: true as const };
}

// ─── Datos de los viajeros de un viaje ───────────────────────────────────────

/**
 * Qué le falta a cada viajero del viaje: la fecha de nacimiento siempre; el pasaporte, salvo en los
 * viajes de destino genérico (pueden ser nacionales); la altura, solo a los menores.
 */
export function travelerGaps(travelers: { firstName: string; birthDate: Date | null; heightCm: number | null; passportExpiry: Date | null }[], tripStart: Date | null, needsPassport = true) {
  return travelers.map((t) => {
    const age = ageOn(t.birthDate, tripStart ?? undefined);
    const missing = [!t.birthDate && "fecha de nacimiento", needsPassport && !t.passportExpiry && "vencimiento del pasaporte", age !== null && age < 18 && !t.heightCm && "altura"].filter(
      (x): x is string => !!x,
    );
    return { name: t.firstName, missing };
  });
}

/** Qué faltaba cuando se descartó el aviso: si cambia (otro viajero, otro dato), el aviso vuelve. */
export const gapsSignature = (gaps: { name: string; missing: string[] }[]) =>
  gaps
    .filter((g) => g.missing.length)
    .map((g) => `${g.name}:${g.missing.join(",")}`)
    .sort()
    .join("|");

// ─── Automatizaciones de formularios por defecto ─────────────────────────────

/** Las tres automatizaciones de formularios que trae toda agencia (en orden del viaje). */
const FORM_WORKFLOWS = [
  {
    template: "travelers",
    name: "Reservado: pedir datos de los viajeros",
    description: "Cuando el viaje pasa a Reservado, le pide al cliente nacimiento, altura, alergias y vencimiento del pasaporte de cada viajero.",
    trigger: "STATUS_CHANGED" as const,
    triggerConfig: { status: "BOOKED" },
  },
  {
    template: "pretrip",
    name: "Cuestionario previo al viaje",
    description: "45 días antes de viajar: llegada, celebraciones, ritmo y lo que no se quieren perder (va a las notas del viaje para el itinerario).",
    trigger: "DAYS_BEFORE_TRAVEL" as const,
    triggerConfig: { days: 45 },
  },
  {
    template: "survey",
    name: "Encuesta post-viaje",
    description: "4 días después de volver, les pregunta cómo les fue.",
    trigger: "DAYS_AFTER_TRAVEL" as const,
    triggerConfig: { days: 4 },
  },
];

/**
 * Crea una sola vez por agencia los formularios y las automatizaciones que los envían. Corre con las
 * automatizaciones por fecha, así también llega a las agencias que ya existían; si después se borran, no vuelven.
 */
export async function seedFormWorkflows(organizationId: string) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { marketingCode: true, formWorkflowsSeededAt: true } });
  if (org.formWorkflowsSeededAt) return;
  const claimed = await db.organization.updateMany({ where: { id: organizationId, formWorkflowsSeededAt: null }, data: { formWorkflowsSeededAt: new Date() } });
  if (claimed.count === 0) return; // otro pedido ya las está creando
  for (const w of FORM_WORKFLOWS) {
    const form = await formFromTemplate(organizationId, org.marketingCode, w.template);
    const workflow = await db.workflow.create({
      data: {
        organizationId,
        name: w.name,
        description: w.description,
        trigger: w.trigger,
        triggerConfig: w.triggerConfig,
        destinations: [],
        actions: [{ type: "SEND_FORM", formId: form.id }],
        active: true,
      },
    });
    // Los viajes que ya están dentro de la ventana quedan como procesados: la automatización actúa sobre los
    // viajes que lleguen a esas fechas desde ahora, no les manda formularios de golpe a todos los clientes actuales.
    const today = todayUTC();
    const days = w.triggerConfig.days ?? 0;
    const existing =
      w.trigger === "DAYS_BEFORE_TRAVEL"
        ? await db.booking.findMany({ where: { organizationId, startDate: { gt: today, lte: addDays(today, days) } }, select: { id: true, clientId: true, startDate: true } })
        : w.trigger === "DAYS_AFTER_TRAVEL"
          ? await db.booking.findMany({ where: { organizationId, endDate: { lte: addDays(today, -days), gt: addDays(today, -days - 14) } }, select: { id: true, clientId: true, endDate: true } })
          : [];
    if (existing.length) {
      await db.workflowRun.createMany({
        data: existing.map((b) => ({
          workflowId: workflow.id,
          dedupeKey: `${b.id}:${("startDate" in b ? b.startDate : b.endDate)!.toISOString().slice(0, 10)}`,
          bookingId: b.id,
          clientId: b.clientId,
          success: true,
          error: "Omitido: el viaje ya estaba en esa fecha cuando se creó la automatización",
        })),
        skipDuplicates: true,
      });
    }
  }
}
