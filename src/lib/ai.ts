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
}

export interface AIProvider {
  categorize(
    descriptions: string[],
    categories: CategoryOption[],
    existingMappings?: MerchantMapping[],
  ): Promise<CategorizationResult[]>;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  descriptions: string[],
  categories: CategoryOption[],
  mappings: MerchantMapping[],
): string {
  // Group categories by their group name
  const grouped = new Map<string, string[]>();
  for (const cat of categories) {
    const group = cat.group || "Other";
    const existing = grouped.get(group) ?? [];
    existing.push(cat.name);
    grouped.set(group, existing);
  }

  let categoryList = "Categories (the ONLY valid options):\n";
  for (const [group, names] of grouped) {
    categoryList += `- ${group}: ${names.join(", ")}\n`;
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

  const merchantList = descriptions.map((d, i) => `${i + 1}. "${d}"`).join("\n");

  return `You are a transaction categorizer for a Canadian household budget. You receive raw merchant descriptions from bank statements and must:
1. Classify each into one of the user's categories
2. Provide a clean, human-readable name for the merchant

Bank statements use cryptic abbreviations. Clean them up:
- "AMZN Mktp CA*BD2CQ1OG0 TORONTO ON" → "Amazon"
- "GOOGLE *YouTube Premiu HALIFAX NS" → "YouTube Premium"
- "SQ *AUX SOINS D 'ISABE SAINT-CHARLESQC" → "Aux Soins d'Isabelle"
- "METRO BELAIR JOLIETTE JOLIETTE QC" → "Metro Belair Joliette"
- "SHELL C80031 SAINT-PAUL QC" → "Shell Saint-Paul"
- "PC EXPRESS #8687 JOLIETTE QC" → "PC Express Joliette"
- "NBX*MUN. SAINT-PAUL SAINT-PAUL QC" → "Municipalité Saint-Paul"
- "FIZZ (TX. INCL.) MONTREAL QC" → "Fizz"
- "PRLVT" → "Prélèvement automatique"

Rules for the display name:
- Remove transaction codes, reference numbers, and cryptic prefixes (*, #, SQ, AMZN, etc.)
- Keep the merchant name and optionally the city if it helps distinguish locations
- Use proper capitalization (title case or brand-correct)
- Keep it concise — 2-4 words max
- For well-known brands, use the standard name (Netflix, Spotify, Apple, Google, Amazon)

${categoryList}
${examples}
For each merchant, respond with a JSON array where each element has:
- "index": the merchant number (1-based)
- "name": the clean display name
- "category": exact category name from the list above, or "UNCATEGORIZED"
- "confidence": "high", "medium", or "low"

Merchants to classify:
${merchantList}

Respond ONLY with a JSON array. No explanation.`;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseResponse(
  raw: string,
  descriptions: string[],
  categories: CategoryOption[],
): CategorizationResult[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return descriptions.map((d) => ({
      description: d,
      category_id: null,
      confidence: "low" as const,
      displayName: cleanFallback(d),
    }));
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      name?: string;
      category: string;
      confidence: string;
    }>;

    const catLookup = new Map<string, string>();
    for (const c of categories) {
      catLookup.set(c.name.toLowerCase(), c.id);
    }

    return descriptions.map((desc, i) => {
      const match = parsed.find((p) => p.index === i + 1);
      if (!match || match.category === "UNCATEGORIZED") {
        return {
          description: desc,
          category_id: null,
          confidence: "low" as const,
          displayName: match?.name || cleanFallback(desc),
        };
      }

      const catId = catLookup.get(match.category.toLowerCase()) ?? null;
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
  } catch {
    return descriptions.map((d) => ({
      description: d,
      category_id: null,
      confidence: "low" as const,
      displayName: cleanFallback(d),
    }));
  }
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
  ): Promise<CategorizationResult[]> {
    if (descriptions.length === 0) return [];

    const prompt = buildPrompt(descriptions, categories, existingMappings);

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: { temperature: 0.1 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { response: string };
    return parseResponse(data.response, descriptions, categories);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let provider: AIProvider = new OllamaProvider();

export function getAIProvider(): AIProvider {
  return provider;
}

export function setAIProvider(p: AIProvider) {
  provider = p;
}
