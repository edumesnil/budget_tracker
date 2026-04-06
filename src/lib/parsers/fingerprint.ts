import type { TextItem } from "./schema-types";

const BANK_PATTERNS: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /DESJARDINS/i, id: "DESJARDINS" },
  { pattern: /\bTD\b|TORONTO.DOMINION/i, id: "TD" },
  { pattern: /\bBMO\b|BANQUE\s+DE\s+MONTR[ÉE]AL/i, id: "BMO" },
  { pattern: /\bRBC\b|ROYAL\s+BANK/i, id: "RBC" },
  { pattern: /\bSCOTIA/i, id: "SCOTIA" },
  { pattern: /\bCIBC\b/i, id: "CIBC" },
  { pattern: /NATIONAL\s+BANK|BANQUE\s+NATIONALE/i, id: "BNC" },
  { pattern: /TANGERINE/i, id: "TANGERINE" },
  { pattern: /WEALTHSIMPLE/i, id: "WEALTHSIMPLE" },
];

const FORMAT_PATTERNS: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /MASTERCARD|VISA/i, id: "CC" },
  { pattern: /RELEV[ÉE]\s+DE\s+COMPTE/i, id: "CHEQUING" },
  { pattern: /[ÉE]PARGNE|SAVINGS/i, id: "SAVINGS" },
];

/**
 * Find the column header line: first line where 4+ short items
 * span a total x-range > 300px.
 */
export function detectColumnHeaderLine(lines: TextItem[][]): TextItem[] | null {
  for (const line of lines) {
    if (line.length < 4) continue;
    const shortItems = line.filter((it) => it.text.length <= 20);
    if (shortItems.length < 4) continue;
    const xs = shortItems.map((it) => it.x);
    const xRange = Math.max(...xs) - Math.min(...xs);
    if (xRange > 300) return shortItems;
  }
  return null;
}

/** Scan first 20 lines for known bank name patterns */
export function detectBankIdentifier(lines: TextItem[][]): string {
  const searchLines = lines.slice(0, 20);
  const text = searchLines.map((line) => line.map((i) => i.text).join(" ")).join(" ");
  for (const { pattern, id } of BANK_PATTERNS) {
    if (pattern.test(text)) return id;
  }
  return "UNKNOWN";
}

function detectFormatType(lines: TextItem[][]): string {
  const searchLines = lines.slice(0, 20);
  const text = searchLines.map((line) => line.map((i) => i.text).join(" ")).join(" ");
  for (const { pattern, id } of FORMAT_PATTERNS) {
    if (pattern.test(text)) return id;
  }
  return "UNKNOWN";
}

/** Simple string hash (djb2) */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * Compute a deterministic fingerprint from PDF structure.
 * Stable across statements of the same type, changes when layout changes.
 */
export function computeFingerprint(lines: TextItem[][]): string {
  const headerLine = detectColumnHeaderLine(lines);
  const headerText = headerLine
    ? headerLine
        .map((it) => `${Math.round(it.x / 10) * 10}:${it.text}`)
        .sort((a, b) => {
          const xa = parseInt(a.split(":")[0]);
          const xb = parseInt(b.split(":")[0]);
          return xa - xb;
        })
        .join("|")
    : "NO_HEADER";

  const bankId = detectBankIdentifier(lines);
  const formatId = detectFormatType(lines);

  const raw = `${bankId}::${formatId}::${headerText}`;
  return hash(raw);
}
