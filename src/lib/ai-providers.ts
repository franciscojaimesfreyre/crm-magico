import "server-only";
// Proveedores de IA. Se elige con AI_PROVIDER en el .env (por defecto, anthropic) y, si hace falta,
// otro modelo con AI_MODEL. Todas las funciones de IA del CRM (itinerario, mensaje de cotización,
// preguntas sobre novedades) pasan por callStructured: piden una respuesta con un formato fijo
// (un esquema de zod) y la devuelven ya validada.
//
// Para sumar otro proveedor compatible con la API de OpenAI (Gemini, OpenRouter, Mistral…) alcanza
// con agregar una entrada en PROVIDERS con su URL, su variable de API key y su modelo por defecto.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export class AIError extends Error {}

type OpenAICompatible = {
  kind: "openai";
  label: string;
  baseURL: string;
  keyEnv: string;
  defaultModel: string;
  /** json_schema: el proveedor respeta un esquema estricto. json_object: solo garantiza JSON válido. */
  jsonMode: "json_schema" | "json_object";
  maxTokens: number;
  /** Nombre del parámetro de tope de salida (la mayoría acepta max_completion_tokens; DeepSeek, max_tokens). */
  maxTokensParam?: "max_tokens" | "max_completion_tokens";
  /** Cuánto esperar la respuesta: los modelos que razonan mucho pueden tardar minutos. */
  timeoutMs: number;
  extra?: (model: string) => Record<string, unknown>;
};

type AnthropicProvider = {
  kind: "anthropic";
  label: string;
  keyEnv: string;
  defaultModel: string;
};

const PROVIDERS = {
  anthropic: {
    kind: "anthropic",
    label: "Anthropic (Claude)",
    keyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-opus-5-5",
  },
  groq: {
    kind: "openai",
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    defaultModel: "openai/gpt-oss-120b",
    jsonMode: "json_schema",
    maxTokens: 32000,
    timeoutMs: 180_000,
    // Los modelos gpt-oss razonan antes de responder; "medium" equilibra calidad y tokens.
    extra: (model) => (model.includes("gpt-oss") ? { reasoning_effort: "medium" } : {}),
  },
  deepseek: {
    kind: "openai",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    keyEnv: "DEEPSEEK_API_KEY",
    // V4.1 Flash: un itinerario en ~1,5 min por ~US$0,03. Para más detalle, AI_MODEL=deepseek-v4-pro (~3 min).
    defaultModel: "deepseek-flash",
    // DeepSeek garantiza JSON válido pero no un esquema estricto: el esquema va en las instrucciones y
    // la respuesta se valida acá (con un reintento si no lo cumple).
    jsonMode: "json_object",
    // Razona antes de responder: un itinerario usa ~25.000 tokens de salida.
    maxTokens: 64000,
    maxTokensParam: "max_tokens",
    timeoutMs: 300_000,
  },
} satisfies Record<string, AnthropicProvider | OpenAICompatible>;

export type AIProviderId = keyof typeof PROVIDERS;

/** Proveedor y modelo configurados en el .env. */
export function aiSettings() {
  const id = (process.env.AI_PROVIDER?.trim().toLowerCase() || "anthropic") as AIProviderId;
  const provider: AnthropicProvider | OpenAICompatible | undefined = PROVIDERS[id];
  if (!provider) {
    throw new AIError(`AI_PROVIDER "${process.env.AI_PROVIDER}" no existe. Opciones: ${Object.keys(PROVIDERS).join(", ")}.`);
  }
  return {
    id,
    provider,
    model: process.env.AI_MODEL?.trim() || provider.defaultModel,
  };
}

/** ¿Hay credenciales para el proveedor elegido? */
export function aiConfigured() {
  try {
    const { provider } = aiSettings();
    if (provider.kind === "anthropic") {
      return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
    }
    return Boolean(process.env[provider.keyEnv]);
  } catch {
    return false;
  }
}

type StructuredRequest<T extends z.ZodType> = {
  system: string;
  user: string;
  schema: T;
};

export async function callStructured<T extends z.ZodType>(opts: StructuredRequest<T>): Promise<z.infer<T>> {
  const { provider, model } = aiSettings();
  return provider.kind === "anthropic" ? callAnthropic(model, opts) : callOpenAICompatible(provider, model, opts);
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
function anthropic() {
  // Sin argumentos: toma ANTHROPIC_API_KEY o el perfil de `ant auth login`.
  anthropicClient ??= new Anthropic();
  return anthropicClient;
}

async function callAnthropic<T extends z.ZodType>(model: string, opts: StructuredRequest<T>): Promise<z.infer<T>> {
  try {
    const stream = anthropic().beta.messages.stream({
      model,
      max_tokens: 64000,
      // Si el modelo declina por política, la API reintenta con el modelo de respaldo recomendado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(opts.schema),
      },
      system: [
        {
          type: "text",
          text: opts.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.user }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      throw new AIError("La IA no pudo procesar este pedido. Probá reformulando las instrucciones.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new AIError("La respuesta de la IA quedó incompleta. Probá con un viaje más corto o menos instrucciones.");
    }
    if (!message.parsed_output) throw new AIError("La IA devolvió una respuesta con formato inválido.");
    return message.parsed_output as z.infer<T>;
  } catch (error) {
    if (error instanceof AIError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AIError("Falta configurar la API key de Anthropic (ANTHROPIC_API_KEY).");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AIError("La IA está saturada en este momento. Probá de nuevo en unos minutos.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AIError(`Error de la API de IA (${error.status ?? "sin estado"}): ${error.message}`);
    }
    if (error instanceof Error && /api key|apiKey|credentials/i.test(error.message)) {
      throw new AIError("Falta configurar la API key de Anthropic (ANTHROPIC_API_KEY).");
    }
    throw error;
  }
}

// ─── Compatibles con la API de OpenAI (Groq, DeepSeek…) ──────────────────────

/** Esquema JSON para el proveedor: objetos cerrados y todos los campos obligatorios (modo estricto). */
function jsonSchemaFor(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { io: "output" }) as Record<string, unknown>;
  delete json.$schema;
  const close = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(close);
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object" && n.properties) {
      n.additionalProperties = false;
      n.required = Object.keys(n.properties);
    }
    Object.values(n).forEach(close);
  };
  close(json);
  return json;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callOpenAICompatible<T extends z.ZodType>(p: OpenAICompatible, model: string, opts: StructuredRequest<T>): Promise<z.infer<T>> {
  const key = process.env[p.keyEnv];
  if (!key) throw new AIError(`Falta configurar la API key de ${p.label} (${p.keyEnv}).`);
  const schema = jsonSchemaFor(opts.schema);
  const system =
    p.jsonMode === "json_object"
      ? `${opts.system}\n\nRespondé solo con un objeto JSON que cumpla este esquema, sin texto alrededor:\n${JSON.stringify(schema)}`
      : opts.system;
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: opts.user },
  ];

  // Si la respuesta no cumple el formato, se vuelve a pedir una vez, avisando qué falló. No se reenvía
  // la respuesta anterior: duplicaría los tokens y en planes chicos supera el límite por minuto.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const content = await chatCompletion(p, key, model, messages, schema);
    let parsed: unknown;
    let problem: string;
    try {
      parsed = JSON.parse(content);
      const result = opts.schema.safeParse(parsed);
      if (result.success) return result.data;
      problem = z.prettifyError(result.error);
    } catch {
      problem = "no es un JSON válido";
    }
    console.warn(`[IA] ${p.label} (${model}) devolvió un formato inválido (intento ${attempt}): ${problem.slice(0, 500)}`);
    if (attempt === 2) break;
    messages[1] = {
      role: "user",
      content: `${opts.user}\n\nAtención: un intento anterior no cumplió el formato pedido (${problem.slice(0, 800)}). Respetá exactamente el esquema.`,
    };
  }
  throw new AIError("La IA devolvió una respuesta con formato inválido. Probá de nuevo.");
}

async function chatCompletion(p: OpenAICompatible, key: string, model: string, messages: ChatMessage[], schema: object) {
  let res: Response;
  const body = JSON.stringify({
    model,
    messages,
    [p.maxTokensParam ?? "max_completion_tokens"]: p.maxTokens,
    response_format:
      p.jsonMode === "json_schema"
        ? {
            type: "json_schema",
            json_schema: { name: "respuesta", schema, strict: true },
          }
        : { type: "json_object" },
    ...p.extra?.(model),
  });
  const started = Date.now();
  try {
    res = await fetch(`${p.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(p.timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new AIError("La IA tardó demasiado en responder. Probá de nuevo.");
    throw new AIError(`No se pudo conectar con ${p.label}. Revisá la conexión e intentá de nuevo.`);
  }

  const data = (await res.json().catch(() => null)) as {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: {
      message?: { content?: string | null; refusal?: string | null };
      finish_reason?: string;
    }[];
    error?: { message?: string };
  } | null;
  console.info(
    `[IA] ${p.label} ${model}: ${res.status} en ${((Date.now() - started) / 1000).toFixed(1)} s · pedido ${body.length} caracteres` +
      (data?.usage ? ` · tokens ${data.usage.prompt_tokens} de entrada, ${data.usage.completion_tokens} de salida` : ""),
  );
  if (!res.ok) {
    // Groq valida el esquema después de generar y, si no lo cumple, rechaza la respuesta pero la
    // devuelve en failed_generation: se valida acá (con tolerancias) en vez de perderla.
    const failed = (data?.error as { failed_generation?: string } | undefined)?.failed_generation;
    if (res.status === 400 && failed) return failed;
    if (res.status === 401 || res.status === 403) throw new AIError(`La API key de ${p.label} no es válida (${p.keyEnv}).`);
    if (res.status === 429) throw new AIError(`${p.label} está saturado o se alcanzó el límite del plan. Probá de nuevo en un minuto.`);
    if (res.status === 404) throw new AIError(`${p.label} no tiene el modelo "${model}". Revisá AI_MODEL.`);
    throw new AIError(`Error de ${p.label} (${res.status}): ${data?.error?.message ?? "sin detalle"}`);
  }
  const choice = data?.choices?.[0];
  if (choice?.message?.refusal) throw new AIError("La IA no pudo procesar este pedido. Probá reformulando las instrucciones.");
  if (choice?.finish_reason === "length") {
    throw new AIError("La respuesta de la IA quedó incompleta. Probá con un viaje más corto o menos instrucciones.");
  }
  const content = choice?.message?.content;
  if (!content) throw new AIError("La IA devolvió una respuesta vacía. Probá de nuevo.");
  return content;
}
