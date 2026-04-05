// =============================================================================
// LLM Adapter — constrained merchant categorization
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

  // Build category list with group context
  let categoryList = "Categories (the ONLY valid options):\n";
  for (const [group, names] of grouped) {
    categoryList += `- ${group}: ${names.join(", ")}\n`;
  }

  // Build few-shot examples from existing merchant mappings
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

  return `You are a transaction categorizer for a household budget. Given merchant descriptions from bank statements, classify each into exactly one of the user's categories.

${categoryList}
${examples}
Classify each merchant below. For each, respond with a JSON array where each element has:
- "index": the merchant number (1-based)
- "category": exact category name from the list above, or "UNCATEGORIZED" if you cannot determine
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
  // Extract JSON array from response (handle markdown code blocks)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return descriptions.map((d) => ({
      description: d,
      category_id: null,
      confidence: "low" as const,
    }));
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      category: string;
      confidence: string;
    }>;

    // Build a name→id lookup
    const catLookup = new Map<string, string>();
    for (const c of categories) {
      catLookup.set(c.name.toLowerCase(), c.id);
    }

    return descriptions.map((desc, i) => {
      const match = parsed.find((p) => p.index === i + 1);
      if (!match || match.category === "UNCATEGORIZED") {
        return { description: desc, category_id: null, confidence: "low" as const };
      }

      const catId = catLookup.get(match.category.toLowerCase()) ?? null;
      const confidence = (
        ["high", "medium", "low"].includes(match.confidence) ? match.confidence : "low"
      ) as "high" | "medium" | "low";

      return { description: desc, category_id: catId, confidence };
    });
  } catch {
    return descriptions.map((d) => ({
      description: d,
      category_id: null,
      confidence: "low" as const,
    }));
  }
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
