import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { sanitize } from "@/lib/sanitizer";
import { getAIProvider, cleanFallback } from "@/lib/ai";
import { parsePdf } from "@/lib/parsers/pdf";
import { getHeaders, parseCsv, detectColumns } from "@/lib/parsers/csv";
import type { ParsedTransaction, CsvColumnMap } from "@/lib/parsers/types";
import type { MerchantMapping, Category } from "@/types/database";
import type { CategoryOption } from "@/lib/ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportStatus =
  | "idle"
  | "parsing"
  | "mapping" // CSV column mapping needed
  | "categorizing"
  | "reviewing"
  | "importing"
  | "done";

export interface ReviewItem {
  id: string; // local ID for tracking
  date: string;
  description: string; // original (unsanitized) for display
  displayName: string; // clean, human-readable name
  sanitizedDescription: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category_id: string | null;
  confidence: "high" | "medium" | "low" | "known"; // "known" = from merchant mapping
  status: "pending" | "accepted" | "skipped";
  duplicate: DuplicateMatch | null;
}

export interface DuplicateMatch {
  transaction_id: string;
  description: string | null;
  date: string;
  amount: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useImport(
  categories: Category[],
  categoryGroups: Array<{ id: string; name: string }>,
  merchantMappings: MerchantMapping[],
) {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // CSV-specific state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);

  // Keep a ref to abort
  const abortRef = useRef(false);

  // Build category options for the AI
  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    group: categoryGroups.find((g) => g.id === c.group_id)?.name ?? "",
  }));

  // -------------------------------------------------------------------------
  // Duplicate detection
  // -------------------------------------------------------------------------

  async function findDuplicates(txs: ParsedTransaction[]): Promise<Map<number, DuplicateMatch>> {
    const dupes = new Map<number, DuplicateMatch>();
    if (txs.length === 0) return dupes;

    // Get date range of import batch
    const dates = txs.map((t) => t.date);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    // Pad by 3 days to catch near-matches
    const padStart = new Date(minDate);
    padStart.setDate(padStart.getDate() - 3);
    const padEnd = new Date(maxDate);
    padEnd.setDate(padEnd.getDate() + 3);

    const { data: existing } = await supabase
      .from("transactions")
      .select("id, amount, date, description, category_id")
      .gte("date", padStart.toISOString().split("T")[0])
      .lte("date", padEnd.toISOString().split("T")[0]);

    if (!existing || existing.length === 0) return dupes;

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      for (const ex of existing) {
        // Same amount (within 0.01) + date within 3 days
        const amountMatch = Math.abs(Number(ex.amount) - tx.amount) < 0.01;
        const daysDiff = Math.abs(
          (new Date(tx.date).getTime() - new Date(ex.date).getTime()) / 86400000,
        );
        if (amountMatch && daysDiff <= 3) {
          dupes.set(i, {
            transaction_id: ex.id,
            description: ex.description,
            date: ex.date,
            amount: Number(ex.amount),
          });
          break;
        }
      }
    }

    return dupes;
  }

  // -------------------------------------------------------------------------
  // Core pipeline: parse → sanitize → lookup → categorize → review
  // -------------------------------------------------------------------------

  async function processTransactions(parsed: ParsedTransaction[]) {
    setStatus("categorizing");
    setProgress(0);

    const duplicates = await findDuplicates(parsed);

    const reviewItems: ReviewItem[] = [];
    const unknowns: { index: number; description: string }[] = [];

    // First pass: look up known merchants
    for (let i = 0; i < parsed.length; i++) {
      const tx = parsed[i];
      const sanitized = sanitize(tx.description);
      const mapping = merchantMappings.find((m) =>
        tx.description.toUpperCase().includes(m.merchant_pattern.toUpperCase()),
      );

      const item: ReviewItem = {
        id: `import-${i}`,
        date: tx.date,
        description: tx.description,
        displayName: cleanFallback(tx.description),
        sanitizedDescription: sanitized,
        amount: tx.amount,
        type: tx.type,
        category_id: mapping?.category_id ?? null,
        confidence: mapping ? "known" : "low",
        status: "pending",
        duplicate: duplicates.get(i) ?? null,
      };

      if (!mapping) {
        unknowns.push({ index: i, description: sanitized });
      }

      reviewItems.push(item);
    }

    setProgress(50);

    // Second pass: send unknowns to LLM
    if (unknowns.length > 0) {
      try {
        const ai = getAIProvider();
        const results = await ai.categorize(
          unknowns.map((u) => u.description),
          categoryOptions,
          merchantMappings,
        );

        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          const idx = unknowns[j].index;
          reviewItems[idx].category_id = r.category_id;
          reviewItems[idx].confidence = r.confidence;
          reviewItems[idx].displayName = r.displayName;
        }
      } catch (err) {
        // LLM failed — leave unknowns as uncategorized, let user handle in review
        const msg = err instanceof Error ? err.message : "Unknown error";
        setWarnings((w) => [
          ...w,
          `AI categorization failed: ${msg}. Unknown merchants will need manual categorization.`,
        ]);
      }
    }

    // Pre-accept high-confidence and known items (user can override)
    for (const item of reviewItems) {
      if (
        (item.confidence === "high" || item.confidence === "known") &&
        item.category_id &&
        !item.duplicate
      ) {
        item.status = "accepted";
      }
    }

    // Sort by date ascending
    reviewItems.sort((a, b) => a.date.localeCompare(b.date));

    setProgress(100);
    setItems(reviewItems);
    setStatus("reviewing");
  }

  // -------------------------------------------------------------------------
  // File handlers
  // -------------------------------------------------------------------------

  const handleFile = useCallback(
    async (file: File) => {
      abortRef.current = false;
      setError(null);
      setWarnings([]);
      setItems([]);

      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "pdf") {
        setStatus("parsing");
        try {
          const result = await parsePdf(file);
          setWarnings(result.warnings);
          if (result.transactions.length === 0) {
            setError("No transactions found in the PDF.");
            setStatus("idle");
            return;
          }
          await processTransactions(result.transactions);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to parse PDF");
          setStatus("idle");
        }
      } else if (ext === "csv") {
        setStatus("parsing");
        try {
          const { headers, rows } = await getHeaders(file);
          const autoMap = detectColumns(headers);

          if (autoMap) {
            // Auto-detected — skip column mapping
            const result = parseCsv(rows, autoMap);
            setWarnings(result.warnings);
            if (result.transactions.length === 0) {
              setError("No transactions found in the CSV.");
              setStatus("idle");
              return;
            }
            await processTransactions(result.transactions);
          } else {
            // Need manual column mapping
            setCsvHeaders(headers);
            setCsvRows(rows);
            setStatus("mapping");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to parse CSV");
          setStatus("idle");
        }
      } else {
        setError("Unsupported file type. Use PDF or CSV.");
        setStatus("idle");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [merchantMappings, categories, categoryGroups],
  );

  const handleCsvMapping = useCallback(
    async (columnMap: CsvColumnMap) => {
      const result = parseCsv(csvRows, columnMap);
      setWarnings(result.warnings);
      if (result.transactions.length === 0) {
        setError("No transactions found with the selected columns.");
        setStatus("idle");
        return;
      }
      await processTransactions(result.transactions);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [csvRows, merchantMappings, categories, categoryGroups],
  );

  // -------------------------------------------------------------------------
  // Review actions
  // -------------------------------------------------------------------------

  const updateItem = useCallback((id: string, updates: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const acceptAll = useCallback(() => {
    setItems((prev) =>
      prev.map((item) =>
        item.status === "pending" && item.category_id ? { ...item, status: "accepted" } : item,
      ),
    );
  }, []);

  // -------------------------------------------------------------------------
  // Commit: insert accepted transactions + save new merchant mappings
  // -------------------------------------------------------------------------

  const commit = useCallback(async () => {
    setStatus("importing");
    setProgress(0);

    const accepted = items.filter((i) => i.status === "accepted" && i.category_id);
    if (accepted.length === 0) {
      setError("No transactions to import.");
      setStatus("reviewing");
      return;
    }

    try {
      // Insert transactions in batches of 50
      const batchSize = 50;
      for (let i = 0; i < accepted.length; i += batchSize) {
        const batch = accepted.slice(i, i + batchSize);
        const rows = batch.map((item) => ({
          amount: item.amount,
          date: item.date,
          description: item.displayName,
          notes: item.description, // keep raw bank description as notes
          category_id: item.category_id!,
          is_recurring: false,
        }));

        const { error: insertErr } = await supabase.from("transactions").insert(rows);
        if (insertErr) throw insertErr;

        setProgress(Math.round(((i + batch.length) / accepted.length) * 80));
      }

      // Save new merchant mappings for confirmed categorizations
      const newMappings: Array<{
        merchant_pattern: string;
        category_id: string;
        confidence: number;
      }> = [];
      for (const item of accepted) {
        if (!item.category_id) continue;
        // Only save mappings for items that were reviewed (not already known)
        // Use the sanitized description as the pattern
        const pattern = item.sanitizedDescription
          .toUpperCase()
          .replace(/\s*#\d+/g, "")
          .trim();
        if (pattern.length < 3) continue;

        // Check if mapping already exists
        const exists = merchantMappings.some((m) => m.merchant_pattern.toUpperCase() === pattern);
        if (!exists) {
          newMappings.push({
            merchant_pattern: pattern,
            category_id: item.category_id,
            confidence: item.confidence === "known" ? 1.0 : 0.8,
          });
        }
      }

      // Deduplicate by pattern (keep first occurrence)
      const seen = new Set<string>();
      const uniqueMappings = newMappings.filter((m) => {
        if (seen.has(m.merchant_pattern)) return false;
        seen.add(m.merchant_pattern);
        return true;
      });

      if (uniqueMappings.length > 0) {
        const { error: mapErr } = await supabase.from("merchant_mappings").insert(uniqueMappings);
        if (mapErr) throw mapErr;
      }

      setProgress(100);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import transactions");
      setStatus("reviewing");
    }
  }, [items, merchantMappings]);

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus("idle");
    setItems([]);
    setWarnings([]);
    setError(null);
    setProgress(0);
    setCsvHeaders([]);
    setCsvRows([]);
  }, []);

  return {
    status,
    items,
    warnings,
    error,
    progress,
    csvHeaders,
    handleFile,
    handleCsvMapping,
    updateItem,
    acceptAll,
    commit,
    reset,
  };
}
