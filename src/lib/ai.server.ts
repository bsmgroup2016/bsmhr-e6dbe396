/**
 * AI provider layer — SINGLE place every server-side AI call goes through.
 *
 * Provider order:
 *   1. Lovable AI Gateway  (LOVABLE_API_KEY)  — primary
 *   2. OpenAI directly     (OPENAI_API_KEY)   — first backup
 *   3. Google Gemini       (GOOGLE_API_KEY)   — second backup (vision compatible)
 *   4. Groq                (GROQ_API_KEY)     — third backup (text-only)
 *   5. Cerebras            (CEREBRAS_API_KEY) — fourth backup (text-only)
 *
 * For OCR (vision), the system automatically filters to Lovable, OpenAI, or Gemini.
 */

export type AiProviderName = "lovable" | "openai" | "gemini" | "groq" | "cerebras" | "copyfish" | "copyshish";

interface ProviderConfig {
  name: AiProviderName;
  url: string;
  apiKey: string;
  model: string;
  /** Can this provider read images / scanned documents? */
  vision: boolean;
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
const COPYFISH_URL = "https://api.ocr.space/parse/image";
const COPYSHISH_URL = "https://api.ocr.space/parse/image"; // Alias for user typo

/** Gateway model id must come from the Lovable model catalog. */
const GATEWAY_MODEL = "openai/gpt-5.6-sol";
/** The user's own OpenAI account — model id is theirs to choose. */
const OPENAI_DEFAULT_MODEL = "gpt-4o";
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
const CEREBRAS_DEFAULT_MODEL = "llama-3.3-70b";

const PROVIDER_ORDER: AiProviderName[] = ["lovable", "openai", "gemini", "groq", "cerebras", "copyfish", "copyshish"];

function configured(): ProviderConfig[] {
  const list: ProviderConfig[] = [];
  const env = process.env;

  const demoKeys = {
    COPYFISH_API_KEY: "demo-key-123"
  };

  const activeEnv: Record<string, string | undefined> = { ...demoKeys, ...env };

  // Debug: Log active keys (masked)
  console.log("AI Config - Active providers detection:", 
    Object.keys(activeEnv).filter(k => k.endsWith('_API_KEY') && activeEnv[k])
  );




  if (activeEnv.LOVABLE_API_KEY) {
    list.push({
      name: "lovable",
      url: GATEWAY_URL,
      apiKey: activeEnv.LOVABLE_API_KEY,
      model: env.LOVABLE_AI_MODEL || GATEWAY_MODEL,
      vision: true,
    });
  }
  if (activeEnv.OPENAI_API_KEY) {
    list.push({
      name: "openai",
      url: OPENAI_URL,
      apiKey: activeEnv.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL,
      vision: true,
    });
  }
  if (activeEnv.GOOGLE_API_KEY || activeEnv.GEMINI_API_KEY) {
    list.push({
      name: "gemini",
      url: GEMINI_URL,
      apiKey: activeEnv.GOOGLE_API_KEY || activeEnv.GEMINI_API_KEY || "",
      model: env.GOOGLE_MODEL || GEMINI_DEFAULT_MODEL,
      vision: true,
    });
  }
  if (activeEnv.GROQ_API_KEY) {
    list.push({
      name: "groq",
      url: GROQ_URL,
      apiKey: activeEnv.GROQ_API_KEY,
      model: env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
      vision: false,
    });
  }
  if (activeEnv.CEREBRAS_API_KEY) {
    list.push({
      name: "cerebras",
      url: CEREBRAS_URL,
      apiKey: activeEnv.CEREBRAS_API_KEY,
      model: env.CEREBRAS_MODEL || CEREBRAS_DEFAULT_MODEL,
      vision: false,
    });
  }
  if (activeEnv.COPYFISH_API_KEY) {
    list.push({
      name: "copyfish",
      url: COPYFISH_URL,
      apiKey: activeEnv.COPYFISH_API_KEY,
      model: "ocr-space-v1",
      vision: true,
    });
  }
  if (activeEnv.COPYSHISH_API_KEY) {
    list.push({
      name: "copyshish",
      url: COPYSHISH_URL,
      apiKey: activeEnv.COPYSHISH_API_KEY,
      model: "ocr-space-v1",
      vision: true,
    });
  }

  // Keep the documented order, then let an explicit preference jump the queue.
  list.sort((a, b) => PROVIDER_ORDER.indexOf(a.name) - PROVIDER_ORDER.indexOf(b.name));
  
  // Debug log after sort
  console.log("AI Config - Configured list:", list.map(p => p.name));

  const preferred = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if ((PROVIDER_ORDER as string[]).includes(preferred)) {
    list.sort((a, b) => (a.name === preferred ? -1 : b.name === preferred ? 1 : 0));
  }

  return list;
}

/** Which providers this deployment can use right now (for Settings / health). */
export function aiProviderStatus() {
  const list = configured();
  return {
    providers: list.map((p) => ({ name: p.name, model: p.model, vision: p.vision })),
    primary: list[0]?.name ?? null,
    fallback: list[1]?.name ?? null,
    backups: list.slice(1).map((p) => p.name),
    configured: list.length > 0,
  };
}

export interface AiRequest {
  /** What the model must do, in words. */
  instruction: string;
  /** Optional system framing. */
  system?: string;
  /** Optional image / PDF page as a data URL for vision reads. */
  dataUrl?: string;
  /** Extra plain text context (spreadsheet headers, notes...). */
  context?: string;
  /** Use only this provider (no fallback). */
  only?: AiProviderName;
}

function buildBody(provider: ProviderConfig, req: AiRequest) {
  const prompt = req.context ? `${req.instruction}\n\n${req.context}` : req.instruction;
  const userContent = req.dataUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: req.dataUrl } },
      ]
    : prompt;

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      {
        role: "system",
        content:
          req.system ??
          "You read scanned Singapore HR documents and return strict JSON only. " +
            "Never invent values: omit any field you cannot read. Dates must be YYYY-MM-DD.",
      },
      { role: "user", content: userContent },
    ],
  };
  // GPT-5.6 family on the gateway rejects chat requests unless reasoning is off.
  if (provider.name === "lovable" && provider.model.includes("gpt-5")) {
    body.reasoning_effort = "none";
  }
  return body;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("Nothing readable was found in the document");
  return JSON.parse(match[0]) as unknown;
}

/** Ask the configured provider(s) for a JSON answer, falling back on failure. */
export async function askAiJson(req: AiRequest): Promise<unknown> {
  let list = configured();

  // Filter based on database/settings preference if implemented
  const preferred = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  const disabledProviders = (process.env.AI_DISABLED_PROVIDERS || "").split(",").map(s => s.trim().toLowerCase());
  
  list = list.filter(p => !disabledProviders.includes(p.name));

  // Scanned documents can only go to providers that accept images.
  if (req.dataUrl) list = list.filter((p) => p.vision);
  // Pin a single provider (used by the Gemini-read → OpenAI-audit pipeline).
  if (req.only) list = list.filter((p) => p.name === req.only);
  
  if (list.length === 0) {
    throw new Error(
      req.dataUrl
        ? "No enabled image-capable AI provider is configured — check your AI Center settings"
        : "No AI providers are currently enabled or configured — check your AI Center settings",
    );
  }


  let lastError: Error | null = null;
  for (const provider of list) {
    try {
      if (provider.name === 'copyfish' || provider.name === 'copyshish') {
        // OCR.space (Copyfish) specific handling
        if (!req.dataUrl) continue;
        const formData = new FormData();
        formData.append("apikey", provider.apiKey);
        formData.append("base64Image", req.dataUrl);
        formData.append("isOverlayRequired", "false");
        
        const res = await fetch(provider.url, {
          method: "POST",
          body: formData,
        });
        
        const data = await res.json() as any;
        if (data.OCRExitCode !== 1) throw new Error(`Copyfish failed: ${data.ErrorMessage?.[0] || 'Unknown error'}`);
        // Copyfish gives text, we need to wrap it for extractJson if we want to maintain flow
        return { text: data.ParsedResults?.[0]?.ParsedText || "" };
      }

      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildBody(provider, req)),
      });

      if (!res.ok) {
        const detail = (await res.text()).slice(0, 400);
        if (res.status === 429) throw new Error(`${provider.name}: rate limit reached`);
        if (res.status === 402) throw new Error(`${provider.name}: AI credits exhausted`);
        throw new Error(`${provider.name} failed (${res.status}): ${detail}`);
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return extractJson(json.choices?.[0]?.message?.content ?? "");
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.error(`AI provider ${provider.name} failed:`, lastError.message);
      // fall through to the next provider (OpenAI backup)
    }
  }
  throw lastError ?? new Error("AI request failed");
}
