import type { ParsedTransaction, ValidatedTransaction } from "./types";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface ValidationResult {
  clean: ValidatedTransaction[];
  flagged: ValidatedTransaction[];
  unparseable: ValidatedTransaction[];
}

export function validateTransactions(
  transactions: ParsedTransaction[],
  rawLines?: string[],
): ValidationResult {
  const clean: ValidatedTransaction[] = [];
  const flagged: ValidatedTransaction[] = [];
  const unparseable: ValidatedTransaction[] = [];

  const amounts = transactions.filter((t) => t.amount > 0).map((t) => t.amount);
  const med = median(amounts);

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const rawLine = rawLines?.[i] ?? tx.description;
    const warnings: string[] = [];

    if (tx.amount === 0 || isNaN(tx.amount)) {
      unparseable.push({
        ...tx,
        warnings: [],
        rawLine,
        parseError: "No valid amount found",
      });
      continue;
    }

    if (tx.description.length < 3) {
      unparseable.push({
        ...tx,
        warnings: [],
        rawLine,
        parseError: "description too short or empty",
      });
      continue;
    }

    if (tx.amount > 10000) {
      warnings.push(
        `$${tx.amount.toLocaleString()} is unusually high — verify the amount is correct, or click to edit`,
      );
    }

    if (med > 0 && tx.amount > med * 10 && transactions.length >= 5) {
      warnings.push(
        `$${tx.amount.toLocaleString()} is ${Math.round(tx.amount / med)}x larger than typical — verify or edit the amount`,
      );
    }

    if (tx.amount > 50000 && tx.amount % 1000 === 0) {
      warnings.push("Suspiciously round large amount — may have grabbed balance column");
    }

    const validated: ValidatedTransaction = { ...tx, warnings, rawLine };

    if (warnings.length > 0) {
      flagged.push(validated);
    } else {
      clean.push(validated);
    }
  }

  return { clean, flagged, unparseable };
}
