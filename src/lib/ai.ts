// =============================================================================
// LLM Adapter — constrained merchant categorization + name cleanup
// =============================================================================

import type { MerchantMapping } from "@/types/database";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CategoryOption {
  id: string;
  name: string;
  group: string;
}

export interface CategorizationResult {
  description: string;
  category_id: string | null; // null = UNCATEGORIZED
  confidence: "high" | "medium" | "low";
  displayName: string; // clean, human-readable merchant name
  suggestedCategory?: string; // when uncategorized, AI suggests a new category name
}

export interface AIProvider {
  categorize(
    descriptions: string[],
    categories: CategoryOption[],
    existingMappings?: MerchantMapping[],
    types?: Array<"INCOME" | "EXPENSE">,
  ): Promise<CategorizationResult[]>;
}

// ---------------------------------------------------------------------------
// Retry helper — handles transient errors and rate limits
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { maxRetries = 2, baseDelay = 1000 }: { maxRetries?: number; baseDelay?: number } = {},
): Promise<Response> {
  let lastErr: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);

    // Success or client error (4xx except 429) — don't retry
    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
      return res;
    }

    // Rate limit (429) or server error (5xx) — retry with backoff
    lastErr = new Error(`HTTP ${res.status}: ${await res.text()}`);
    console.warn(`[ai] Request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${res.status}`);

    if (attempt < maxRetries) {
      // Use Retry-After header if present, otherwise exponential backoff
      const retryAfter = res.headers.get("retry-after");
      const delay = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : baseDelay * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr!;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

interface BuiltPrompt {
  /** Single prompt string (for Ollama /api/generate) */
  prompt: string;
  /** System message (for chat-based APIs) */
  system: string;
  /** User message (for chat-based APIs) */
  user: string;
  /** Numeric ID → real UUID mapping */
  idMap: Map<number, string>;
}

function buildPrompt(
  descriptions: string[],
  categories: CategoryOption[],
  mappings: MerchantMapping[],
  types?: Array<"INCOME" | "EXPENSE">,
): BuiltPrompt {
  // Assign short numeric IDs to categories for reliable round-tripping
  const idMap = new Map<number, string>(); // numericId → real UUID
  let categoryList = "Categories (use the numeric ID in your response):\n";

  // Group by group name for readability, but each category gets a numeric ID
  const grouped = new Map<string, Array<{ numId: number; name: string }>>();
  let nextId = 1;
  for (const cat of categories) {
    const group = cat.group || "Other";
    const existing = grouped.get(group) ?? [];
    existing.push({ numId: nextId, name: cat.name });
    idMap.set(nextId, cat.id);
    nextId++;
    grouped.set(group, existing);
  }

  for (const [group, cats] of grouped) {
    const items = cats.map((c) => `${c.numId}=${c.name}`).join(", ");
    categoryList += `- ${group}: ${items}\n`;
  }

  // Few-shot examples from existing merchant mappings
  let examples = "";
  if (mappings.length > 0) {
    const byCat = new Map<string, string[]>();
    for (const m of mappings) {
      const cat = categories.find((c) => c.id === m.category_id);
      if (!cat) continue;
      const existing = byCat.get(cat.name) ?? [];
      existing.push(m.merchant_pattern);
      byCat.set(cat.name, existing);
    }

    if (byCat.size > 0) {
      examples = "\nExisting merchant mappings (for reference):\n";
      for (const [catName, merchants] of byCat) {
        examples += `- ${catName}: ${merchants.slice(0, 8).join(", ")}\n`;
      }
    }
  }

  const merchantList = descriptions
    .map((d, i) => {
      const typeLabel = types?.[i] === "INCOME" ? " [INCOME]" : "";
      return `${i + 1}. "${d}"${typeLabel}`;
    })
    .join("\n");

  const hasIncome = types?.some((t) => t === "INCOME");
  const typeInstruction = hasIncome
    ? "\n- Transactions marked [INCOME] are deposits/credits \u2014 assign them to INCOME categories, not expense categories"
    : "";

  // System message: concise to minimize per-batch token overhead
  const system = `Categorize bank transaction merchants for a Canadian household budget.
For each merchant: assign a category by numeric ID, and provide a clean display name.

Display name rules: strip codes/refs/prefixes (*, #, SQ*, AMZN, NBX*), keep merchant + optional city, title case, 2-4 words. Use standard brand names (Netflix, Spotify, Amazon, etc.).

Categorization rules:
- Use category_id 0 + suggested_category if no good fit (don't force bad matches)
- Be precise: dentist ≠ optometrist ≠ physiotherapist${typeInstruction}

Respond with JSON: {"results": [{"index": 1, "name": "Clean Name", "category_id": 3, "confidence": "high"}]}
When category_id is 0, add "suggested_category": "New Category Name".
Confidence: "high", "medium", or "low". No text outside JSON.`;

  // User message: data only
  const user = `${categoryList}
${examples}
Merchants to classify:
${merchantList}`;

  // Combined single-string prompt (for non-chat APIs like Ollama generate)
  const prompt = `${system}\n\n${user}`;

  // Debug: log the category ID mapping so we can verify LLM responses
  console.log(
    "[ai] Category ID map:",
    Object.fromEntries(
      [...idMap.entries()].map(([k, v]) => [k, categories.find((c) => c.id === v)?.name ?? v]),
    ),
  );
  console.log("[ai] Total categories:", idMap.size);
  console.log("[ai] User message sent to LLM:\n", user);

  return { prompt, system, user, idMap };
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

interface RawResult {
  index: number;
  name?: string;
  category_id: number;
  confidence: string;
  suggested_category?: string;
}

/**
 * Extract the results array from the LLM response.
 * Handles multiple formats:
 *  1. {"results": [...]}  (JSON mode response)
 *  2. [...] (bare array)
 *  3. Markdown-wrapped ```json ... ``` blocks
 */
function extractResults(raw: string): RawResult[] | null {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try parsing as a complete JSON value first (handles both object and array)
  try {
    const parsed = JSON.parse(cleaned);

    // Format 1: {"results": [...]}
    if (parsed && Array.isArray(parsed.results)) {
      return parsed.results;
    }

    // Format 2: bare array
    if (Array.isArray(parsed)) {
      return parsed;
    }

    // Unknown object shape — try to find an array property
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0]?.index === "number") {
        return val as RawResult[];
      }
    }
  } catch {
    // Full parse failed — try regex extraction as last resort
  }

  // Fallback: extract the first JSON array from the string (non-greedy)
  const arrayMatch = cleaned.match(/\[[\s\S]*?\](?=\s*$|\s*})/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // Give up
    }
  }

  return null;
}

function parseResponse(
  raw: string,
  descriptions: string[],
  idMap: Map<number, string>,
): CategorizationResult[] {
  console.log("[ai] Raw LLM response:", raw.slice(0, 500));

  const fallbackAll = () =>
    descriptions.map((d) => ({
      description: d,
      category_id: null,
      confidence: "low" as const,
      displayName: cleanFallback(d),
    }));

  const results = extractResults(raw);
  if (!results) {
    console.warn("[ai] Could not extract results array from response");
    return fallbackAll();
  }

  console.log("[ai] Parsed results:", results.length, "items");

  return descriptions.map((desc, i) => {
    const match = results.find((p) => p.index === i + 1);
    if (!match || !match.category_id || match.category_id === 0) {
      return {
        description: desc,
        category_id: null,
        confidence: "low" as const,
        displayName: match?.name || cleanFallback(desc),
        suggestedCategory: match?.suggested_category,
      };
    }

    // Look up the real UUID from the numeric ID
    const catId = idMap.get(match.category_id) ?? null;

    if (!catId) {
      console.warn(`[ai] Unknown numeric category ID: ${match.category_id}`);
    }

    const confidence = (
      ["high", "medium", "low"].includes(match.confidence) ? match.confidence : "low"
    ) as "high" | "medium" | "low";

    return {
      description: desc,
      category_id: catId,
      confidence,
      displayName: match.name || cleanFallback(desc),
    };
  });
}

// ---------------------------------------------------------------------------
// Fallback name cleanup (no LLM needed — simple heuristics)
// ---------------------------------------------------------------------------

/** Basic cleanup when the LLM is unavailable */
export function cleanFallback(raw: string): string {
  let s = raw;

  // Strip province codes at end (2 uppercase letters)
  s = s.replace(/\s+[A-Z]{2}\s*$/, "");

  // Strip city name if it's duplicated (e.g., "METRO BELAIR JOLIETTE JOLIETTE")
  const words = s.split(/\s+/);
  if (words.length >= 2 && words[words.length - 1] === words[words.length - 2]) {
    words.pop();
    s = words.join(" ");
  }

  // Strip known city names at end (all-caps word after the description)
  // Heuristic: if last word is all-caps and > 3 chars, it might be a city
  const parts = s.split(/\s{2,}/); // split on double-space (column gap)
  if (parts.length > 1) {
    s = parts[0]; // take only the description part, drop city column
  }

  // Strip transaction codes and reference numbers
  s = s
    .replace(/\s*#\s*\d+/g, "") // #1234
    .replace(/\s*\*\S+/g, "") // *BD2CQ1OG0
    .replace(/\b[A-Z]{1,3}\*\s*/g, "") // SQ*, NBX*
    .replace(/\bCA\*\S+/g, "") // CA*BD2CQ1OG0
    .replace(/\b[A-Z0-9]{6,}\b/g, "") // C80031, P3F8942CD6
    .replace(/\(TX\.\s*INCL\.\)/gi, "") // (TX. INCL.)
    .replace(/\s{2,}/g, " ")
    .trim();

  // Title case
  s = s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

  // Brand corrections
  const brands: Record<string, string> = {
    "Netflix.com": "Netflix",
    Netflix: "Netflix",
    Spotify: "Spotify",
    "Apple.com/bill": "Apple",
    "Apple.Com/Bill": "Apple",
    Google: "Google",
    Amzn: "Amazon",
    Amazon: "Amazon",
    Shell: "Shell",
    Fizz: "Fizz",
  };

  for (const [pattern, replacement] of Object.entries(brands)) {
    if (s.toLowerCase().startsWith(pattern.toLowerCase())) {
      const rest = s.slice(pattern.length).trim();
      s = rest ? `${replacement} ${rest}` : replacement;
      break;
    }
  }

  return s || raw;
}

// ---------------------------------------------------------------------------
// Ollama provider (default — local, no data leaves the machine)
// ---------------------------------------------------------------------------

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = "http://localhost:11434", model = "llama3.2") {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async categorize(
    descriptions: string[],
    categories: CategoryOption[],
    existingMappings: MerchantMapping[] = [],
    types?: Array<"INCOME" | "EXPENSE">,
  ): Promise<CategorizationResult[]> {
    if (descriptions.length === 0) return [];

    const { prompt, idMap } = buildPrompt(descriptions, categories, existingMappings, types);

    const res = await fetchWithRetry(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        format: "json", // Ollama JSON mode — constrains output to valid JSON
        stream: false,
        options: { temperature: 0.1 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama request failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as { response: string };
    return parseResponse(data.response, descriptions, idMap);
  }
}

// ---------------------------------------------------------------------------
// Gemini provider (free tier — 15 RPM, 1500 RPD)
// Get API key at https://aistudio.google.com/apikeys
// ---------------------------------------------------------------------------

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.0-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async categorize(
    descriptions: string[],
    categories: CategoryOption[],
    existingMappings: MerchantMapping[] = [],
    types?: Array<"INCOME" | "EXPENSE">,
  ): Promise<CategorizationResult[]> {
    if (descriptions.length === 0) return [];

    const { system, user, idMap } = buildPrompt(descriptions, categories, existingMappings, types);

    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json", // Gemini JSON mode
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini request failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseResponse(text, descriptions, idMap);
  }
}

// ---------------------------------------------------------------------------
// Groq provider (free tier — 30 RPM, 14400 RPD, very fast)
// Get API key at https://console.groq.com/keys
// ---------------------------------------------------------------------------

export class GroqProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "llama-3.3-70b-versatile") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async categorize(
    descriptions: string[],
    categories: CategoryOption[],
    existingMappings: MerchantMapping[] = [],
    types?: Array<"INCOME" | "EXPENSE">,
  ): Promise<CategorizationResult[]> {
    if (descriptions.length === 0) return [];

    const { system, user, idMap } = buildPrompt(descriptions, categories, existingMappings, types);

    const res = await fetchWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }, // Groq JSON mode — guarantees valid JSON
        }),
      },
      { maxRetries: 2, baseDelay: 1000 },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq request failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = data.choices?.[0]?.message?.content ?? "";
    return parseResponse(text, descriptions, idMap);
  }
}

// ---------------------------------------------------------------------------
// Provider selection — auto-detect from env vars (first match wins)
// ---------------------------------------------------------------------------

function createProvider(): AIProvider {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (groqKey) {
    console.log("[ai] Using Groq provider (llama-3.3-70b)");
    return new GroqProvider(groqKey);
  }

  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (geminiKey) {
    console.log("[ai] Using Gemini provider");
    return new GeminiProvider(geminiKey);
  }

  console.log("[ai] No API key found, falling back to Ollama (localhost:11434)");
  return new OllamaProvider();
}

let provider: AIProvider = createProvider();

export function getAIProvider(): AIProvider {
  return provider;
}

export function setAIProvider(p: AIProvider) {
  provider = p;
}
