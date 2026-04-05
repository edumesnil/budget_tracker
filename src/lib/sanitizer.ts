// =============================================================================
// PII Sanitizer — strips sensitive data before LLM sees merchant descriptions
// =============================================================================

// Patterns that indicate PII in transaction descriptions
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Canadian SIN (9 digits, with or without dashes/spaces)
  { pattern: /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g, replacement: "" },
  // Credit/debit card numbers (13-19 digits, possibly grouped)
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{0,7}\b/g, replacement: "" },
  // Account numbers (common formats: XX-XXXXX-XX, XXXXXXXX)
  { pattern: /\b\d{2,3}[-]\d{4,7}[-]\d{2,3}\b/g, replacement: "" },
  // Phone numbers (10-11 digits, various formats)
  { pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "" },
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "" },
  // Dollar amounts with $ sign (balances that leak into descriptions)
  { pattern: /\$\s?\d+[.,]?\d{0,2}/g, replacement: "" },
  // Long digit sequences (8+ digits — likely account/reference numbers)
  { pattern: /\b\d{8,}\b/g, replacement: "" },
  // Desjardins-specific: "PRLVT" followed by digits (pre-authorized payment IDs)
  // Keep the PRLVT prefix but strip the number
  { pattern: /(PRLVT)\s*\d{5,}/g, replacement: "$1" },
];

/**
 * Strip PII from a single merchant description.
 * Returns a cleaned string safe to send to an LLM.
 */
export function sanitize(description: string): string {
  let cleaned = description;
  for (const { pattern, replacement } of PII_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  // Collapse multiple spaces and trim
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

/**
 * Strip PII from an array of merchant descriptions.
 */
export function sanitizeBatch(descriptions: string[]): string[] {
  return descriptions.map(sanitize);
}
