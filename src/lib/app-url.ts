/**
 * URL pública de la app, para links en emails, portal, iCal, etc.
 * APP_URL tiene prioridad; en Render se usa la URL que la plataforma asigna al servicio.
 */
export function appUrl() {
  const url = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
