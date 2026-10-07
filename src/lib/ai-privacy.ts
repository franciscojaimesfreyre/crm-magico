// Privacidad con la IA: el modelo nunca recibe nombres ni datos que identifiquen a los viajeros.
// Cada viajero pasa como "Viajero A", "Viajero B"…; los apellidos, emails, teléfonos y números de
// confirmación se ocultan de los textos libres (notas, descripciones, pedidos del agente). Cuando
// vuelve la respuesta, se reemplazan los alias por los nombres de pila, para que el agente y el
// cliente vean "Tomás" y no "Viajero D". Así se puede usar cualquier modelo sin exponer a nadie.

type Person = { firstName: string; lastName?: string | null };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Palabra completa, respetando letras con tilde (\b no las entiende). Distingue mayúsculas. */
const word = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, "gu");

export function createPseudonymizer(travelers: Person[], others: Person[] = []) {
  const aliases = travelers.map((t, i) => ({ alias: `Viajero ${LETTERS[i] ?? i + 1}`, firstName: t.firstName.trim() }));
  const people = [...travelers, ...others];
  const surnames = [...new Set(people.map((p) => p.lastName?.trim()).filter((s): s is string => !!s && s.length >= 3))];
  // Nombres de pila de quien no viaja (por ej. el titular que compra para otros): se ocultan sin alias.
  const otherFirstNames = others.map((p) => p.firstName.trim()).filter((n) => n.length >= 2 && !aliases.some((a) => a.firstName === n));

  function mask(text: string | null | undefined): string {
    if (!text) return "";
    let out = text
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email oculto]")
      .replace(/\+\d[\d\s().-]{7,}\d/g, "[teléfono oculto]")
      .replace(/(?<!\d)\d{2,4}[\s-]\d{4}[\s-]\d{4}(?!\d)|(?<![\d/-])\d{4}-\d{4}(?![\d/-])/g, "[teléfono oculto]")
      // "Conf. ADR-1234", "confirmación: 55555", "N° de reserva 123ABC"
      .replace(/((?:conf(?:irmaci[oó]n)?|reserva|localizador|n[°º])\.?\s*(?:n[°º]\s*)?(?:de\s+(?:reserva|confirmaci[oó]n)\s*)?[:#]?\s*)([A-Z0-9][A-Z0-9-]{3,})/gi, "$1[código oculto]");
    // Nombre y apellido juntos primero, después apellidos sueltos, después nombres de pila.
    for (const t of travelers) {
      const a = aliases[travelers.indexOf(t)];
      if (t.lastName?.trim()) out = out.replace(word(`${t.firstName.trim()} ${t.lastName.trim()}`), a.alias);
    }
    for (const s of surnames) out = out.replace(word(s), "[apellido]");
    for (const a of aliases) if (a.firstName.length >= 2) out = out.replace(word(a.firstName), a.alias);
    for (const n of otherFirstNames) out = out.replace(word(n), "[nombre]");
    return out;
  }

  function unmask(text: string): string {
    // Plural: "los Viajeros A, B y D" → "Amanda, Diego y Tomás" (cada letra por su nombre, mismos separadores).
    let out = text.replace(/(?:(?<![\p{L}])(?:[Ll]os|[Ll]as) )?[Vv]iajeros ([A-Z](?:, [A-Z])*(?: y [A-Z])?)(?![\p{L}\p{N}])/gu, (all, list: string) => {
      const name = (l: string) => aliases.find((a) => a.alias === `Viajero ${l}`)?.firstName;
      if (list.match(/[A-Z]/g)!.some((l) => !name(l))) return all;
      return list.replace(/[A-Z]/g, (l) => name(l)!);
    });
    // De la última letra a la primera, para no pisar "Viajero A" dentro de un alias más largo.
    for (const a of [...aliases].reverse()) {
      // El modelo a veces escribe "viajero D" en minúscula.
      const alias = `[Vv]iajero ${escape(a.alias.slice("Viajero ".length))}`;
      const end = "(?![\\p{L}\\p{N}])";
      // "del Viajero D" → "de Tomás", "al Viajero D" → "a Tomás", "el Viajero D" → "Tomás".
      out = out
        .replace(new RegExp(`(?<![\\p{L}])([Dd])el ${alias}${end}`, "gu"), `$1e ${a.firstName}`)
        .replace(new RegExp(`(?<![\\p{L}])([Aa])l ${alias}${end}`, "gu"), `$1 ${a.firstName}`)
        .replace(new RegExp(`(?<![\\p{L}])(?:[Ee]l|[Ll]a) ${alias}${end}`, "gu"), a.firstName)
        .replace(new RegExp(`(?<![\\p{L}\\p{N}])${alias}${end}`, "gu"), a.firstName);
    }
    return out;
  }

  /** Reemplaza los alias en todos los textos de la respuesta (objetos, listas, strings). */
  function unmaskDeep<T>(value: T): T {
    if (typeof value === "string") return unmask(value) as T;
    if (Array.isArray(value)) return value.map(unmaskDeep) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unmaskDeep(v)])) as T;
    }
    return value;
  }

  return { aliases, mask, unmask, unmaskDeep, aliasOf: (index: number) => aliases[index]?.alias ?? `Viajero ${index + 1}` };
}

export type Pseudonymizer = ReturnType<typeof createPseudonymizer>;
