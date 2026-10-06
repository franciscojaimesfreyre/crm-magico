import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

function transport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

function toHtml(body: string) {
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e293b">${escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;
}

/**
 * Envía un email si hay SMTP configurado; si no, lo deja registrado como LOGGED
 * para que se pueda revisar desde el CRM. Nunca lanza: devuelve el estado.
 */
export async function sendEmail(input: {
  organizationId: string;
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  clientId?: string | null;
  bookingId?: string | null;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  const t = transport();
  let status: "SENT" | "FAILED" | "LOGGED" = "LOGGED";
  let error: string | undefined;
  if (t) {
    try {
      const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost";
      await t.sendMail({
        from: input.fromName ? `"${input.fromName}" <${from}>` : from,
        to: input.to,
        subject: input.subject,
        text: input.body,
        html: toHtml(input.body),
        attachments: input.attachments,
      });
      status = "SENT";
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message : String(e);
    }
  }
  await db.emailLog.create({
    data: {
      organizationId: input.organizationId,
      to: input.to,
      subject: input.subject,
      body: input.attachments?.length
        ? `${input.body}\n\n[Adjuntos: ${input.attachments.map((a) => a.filename).join(", ")}]`
        : input.body,
      status,
      error,
      clientId: input.clientId ?? undefined,
      bookingId: input.bookingId ?? undefined,
    },
  });
  return { status, error };
}
