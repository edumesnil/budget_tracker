import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { sanitize } from "@/lib/sanitizer";
import { getAIProvider, cleanFallback } from "@/lib/ai";
import { merchantMappingKeys } from "@/hooks/use-merchant-mappings";
import { parsePdf, type SchemaParsePipelineResult } from "@/lib/parsers/pdf";
import { parseWithSchema } from "@/lib/parsers/column-parser";
import { validateTransactions } from "@/lib/parsers/validate";
import { buildSchema, saveSchema } from "@/lib/parsers/schema-store";
import { getHeaders, parseCsv, detectColumns } from "@/lib/parsers/csv";
import type { ParsedTransaction, ValidatedTransaction, CsvColumnMap } from "@/lib/parsers/types";
import type { TextItem, StatementSchema } from "@/lib/parsers/schema-types";
import type { MerchantMapping, Category } from "@/types/database";
import type { CategoryOption } from "@/lib/ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportStatus =
  | "idle"
  | "parsing"
  | "schema_detecting" // AI analyzing format
  | "schema_validating" // user confirming sample rows
  | "mapping" // CSV column mapping needed
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
  aiStatus: "waiting" | "analyzing" | "done" | "skipped"; // per-row AI progress
  duplicate: DuplicateMatch | null;
  suggestedCategory?: string; // AI-suggested new category when nothing fits
  warnings: string[]; // validation warnings
  rawLine?: string; // original PDF line
  parseError?: string; // unparseable reason
  transferType?: "internal" | "external-income" | null;
}

export interface DuplicateMatch {
  transaction_id: string;
  description: string | null;
  date: string;
  amount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useImport(
  categories: Category[],
  categoryGroups: Array<{ id: string; name: string }>,
  merchantMappings: MerchantMapping[],
) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // CSV-specific state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);

  // Keep a ref to abort background categorization
  const abortRef = useRef(false);

  // Schema detection state
  const [schemaPreview, setSchemaPreview] = useState<ParsedTransaction[] | null>(null);
  const [detectedSchema, setDetectedSchema] = useState<Omit<
    StatementSchema,
    "id" | "user_id" | "created_at"
  > | null>(null);
  const [schemaItems, setSchemaItems] = useState<TextItem[][] | null>(null);
  const [schemaFullText, setSchemaFullText] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    clean: ValidatedTransaction[];
    flagged: ValidatedTransaction[];
    unparseable: ValidatedTransaction[];
  } | null>(null);
  const [flaggedFirst, setFlaggedFirst] = useState(false);

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

    // Pad by 1 day to catch posting-date vs transaction-date differences
    const padStart = new Date(minDate);
    padStart.setDate(padStart.getDate() - 1);
    const padEnd = new Date(maxDate);
    padEnd.setDate(padEnd.getDate() + 1);

    const { data: existing } = await supabase
      .from("transactions")
      .select("id, amount, date, description, notes, category_id")
      .gte("date", padStart.toISOString().split("T")[0])
      .lte("date", padEnd.toISOString().split("T")[0]);

    if (!existing || existing.length === 0) return dupes;

    // Track which existing rows have already been matched so one DB row
    // cannot satisfy multiple import rows
    const matchedExisting = new Set<string>();

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const txDescUpper = tx.description.toUpperCase().trim();

      for (const ex of existing) {
        if (matchedExisting.has(ex.id)) continue;

        const amountMatch = Math.abs(Number(ex.amount) - tx.amount) < 0.01;
        if (!amountMatch) continue;

        const daysDiff = Math.abs(
          (new Date(tx.date).getTime() - new Date(ex.date).getTime()) / 86400000,
        );
        if (daysDiff > 1) continue;

        // Compare against raw bank description stored in notes (preferred)
        // or the display name in description as fallback
        const exRaw = ((ex.notes as string | null) ?? ex.description ?? "").toUpperCase().trim();
        const descMatch =
          exRaw.length > 0 && (exRaw.includes(txDescUpper) || txDescUpper.includes(exRaw));

        if (descMatch) {
          matchedExisting.add(ex.id);
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
  // Background AI categorization (streaming batches)
  // -------------------------------------------------------------------------

  async function categorizeInBackground(
    unknowns: Array<{ indices: number[]; sanitizedDesc: string; type: "INCOME" | "EXPENSE" }>,
  ) {
    const ai = getAIProvider();
    const totalUnique = unknowns.length;
    let processed = 0;

    for (let b = 0; b < totalUnique; b += BATCH_SIZE) {
      if (abortRef.current) {
        console.log("[import] Background categorization aborted");
        return;
      }

      const batch = unknowns.slice(b, b + BATCH_SIZE);

      // Mark batch rows as "analyzing"
      setItems((prev) => {
        const next = [...prev];
        for (const entry of batch) {
          for (const idx of entry.indices) {
            next[idx] = { ...next[idx], aiStatus: "analyzing" };
          }
        }
        return next;
      });

      try {
        const descriptions = batch.map((u) => u.sanitizedDesc);
        const types = batch.map((u) => u.type);
        const results = await ai.categorize(descriptions, categoryOptions, merchantMappings, types);

        if (abortRef.current) return;

        // Apply results to all matching rows
        setItems((prev) => {
          const next = [...prev];
          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            const entry = batch[j];
            for (const idx of entry.indices) {
              next[idx] = {
                ...next[idx],
                category_id: r.category_id,
                confidence: r.confidence,
                displayName: r.displayName,
                aiStatus: "done",
                suggestedCategory: r.suggestedCategory,
              };
            }
          }
          return next;
        });

        // Auto-accept high-confidence items from this batch
        setItems((prev) => {
          const next = [...prev];
          for (const entry of batch) {
            for (const idx of entry.indices) {
              const item = next[idx];
              if (
                (item.confidence === "high" || item.confidence === "known") &&
                item.category_id &&
                !item.duplicate
              ) {
                next[idx] = { ...next[idx], status: "accepted" };
              }
            }
          }
          return next;
        });
      } catch (err) {
        // Mark failed batch rows as "done" (uncategorized) so user can handle them
        setItems((prev) => {
          const next = [...prev];
          for (const entry of batch) {
            for (const idx of entry.indices) {
              next[idx] = { ...next[idx], aiStatus: "done" };
            }
          }
          return next;
        });

        const msg = err instanceof Error ? err.message : "Unknown error";
        setWarnings((w) => [
          ...w,
          `AI batch failed: ${msg}. Some merchants will need manual categorization.`,
        ]);
      }

      processed += batch.length;
      setProgress(Math.round((processed / totalUnique) * 100));

      // Rate limit: wait between batches (skip delay after the last batch)
      if (b + BATCH_SIZE < totalUnique && !abortRef.current) {
        await delay(BATCH_DELAY_MS);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Core pipeline: parse → sanitize → lookup → show table → background AI
  // -------------------------------------------------------------------------

  async function processTransactions(parsed: ParsedTransaction[]) {
    setStatus("parsing");
    setProgress(0);

    const duplicates = await findDuplicates(parsed);

    const reviewItems: ReviewItem[] = [];
    // Map: "sanitizedDesc|TYPE" → list of indices + type
    const unknownsByKey = new Map<string, { indices: number[]; type: "INCOME" | "EXPENSE" }>();

    // First pass: look up known merchants, then try category name matching
    for (let i = 0; i < parsed.length; i++) {
      const tx = parsed[i];
      const sanitized = sanitize(tx.description);
      const descUpper = tx.description.toUpperCase();

      // 1. Check merchant_mappings table — verify mapped category type matches
      const mapping = merchantMappings.find((m) => {
        if (!descUpper.includes(m.merchant_pattern.toUpperCase())) return false;
        const cat = categories.find((c) => c.id === m.category_id);
        return !cat || cat.type === tx.type;
      });

      // 2. If no mapping, try direct category name match (prefer same type)
      let nameMatch: { category_id: string; name: string } | null = null;
      if (!mapping) {
        for (const cat of categories) {
          if (
            cat.type === tx.type &&
            cat.name.length >= 3 &&
            descUpper.includes(cat.name.toUpperCase())
          ) {
            nameMatch = { category_id: cat.id, name: cat.name };
            break;
          }
        }
      }

      const isPreMatched = !!(mapping || nameMatch);

      const isDuplicate = duplicates.has(i);

      const item: ReviewItem = {
        id: `import-${i}`,
        date: tx.date,
        description: tx.description,
        displayName: cleanFallback(tx.description),
        sanitizedDescription: sanitized,
        amount: tx.amount,
        type: tx.type,
        category_id: mapping?.category_id ?? nameMatch?.category_id ?? null,
        confidence: mapping ? "known" : nameMatch ? "high" : "low",
        status: isDuplicate ? "skipped" : "pending",
        aiStatus: isDuplicate ? "skipped" : isPreMatched ? "skipped" : "waiting",
        duplicate: duplicates.get(i) ?? null,
        warnings: [],
        rawLine: undefined,
        parseError: undefined,
        transferType: tx.transferType ?? null,
      };

      // Handle internal transfers — auto-skip them
      if (tx.transferType === "internal") {
        item.status = "skipped";
        item.aiStatus = "skipped";
      }

      // Pre-accept high-confidence pre-matched items (not duplicates, not transfers)
      if (!isDuplicate && isPreMatched && item.category_id && tx.transferType !== "internal") {
        item.status = "accepted";
      }

      if (!isPreMatched) {
        // Group by sanitized description + type for deduplication
        const key = `${sanitized}|${tx.type}`;
        const existing = unknownsByKey.get(key);
        if (existing) {
          existing.indices.push(i);
        } else {
          unknownsByKey.set(key, { indices: [i], type: tx.type });
        }
      }

      reviewItems.push(item);
    }

    // Sort by date ascending
    reviewItems.sort((a, b) => a.date.localeCompare(b.date));

    // After sorting, indices in unknownsByKey point to pre-sort positions.
    // We need to rebuild the index mapping based on sorted order.
    const oldToNew = new Map<string, number>();
    for (let newIdx = 0; newIdx < reviewItems.length; newIdx++) {
      oldToNew.set(reviewItems[newIdx].id, newIdx);
    }

    // Build deduplicated unknowns list with post-sort indices
    const unknowns: Array<{
      indices: number[];
      sanitizedDesc: string;
      type: "INCOME" | "EXPENSE";
    }> = [];
    for (const [key, entry] of unknownsByKey) {
      const desc = key.slice(0, key.lastIndexOf("|"));
      const newIndices = entry.indices.map((oi) => {
        const id = `import-${oi}`;
        return oldToNew.get(id)!;
      });
      unknowns.push({ indices: newIndices, sanitizedDesc: desc, type: entry.type });
    }

    // Sort unknowns by their first (earliest) row index so batches process top-to-bottom
    unknowns.sort((a, b) => Math.min(...a.indices) - Math.min(...b.indices));

    const preMatchedCount = reviewItems.filter((r) => r.aiStatus === "skipped").length;
    const uniqueUnknowns = unknowns.length;
    const totalUnknownRows = reviewItems.filter((r) => r.aiStatus === "waiting").length;
    console.log(
      `[import] ${reviewItems.length} transactions: ${preMatchedCount} pre-matched, ${totalUnknownRows} unknown (${uniqueUnknowns} unique descriptions)`,
    );

    // Show the review table immediately
    setItems(reviewItems);
    setStatus("reviewing");
    setProgress(0);

    // Start background AI categorization for unknowns
    if (unknowns.length > 0) {
      categorizeInBackground(unknowns);
    } else {
      setProgress(100);
    }
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
          const result: SchemaParsePipelineResult = await parsePdf(file);
          setWarnings(result.warnings);

          if (result.status === "cached") {
            if (!result.transactions || result.transactions.length === 0) {
              setError("No transactions found in the PDF.");
              setStatus("idle");
              return;
            }
            setValidationResult(result.validation ?? null);
            await processTransactions(result.transactions);
          } else {
            // Need schema detection
            setSchemaItems(result.items ?? null);
            setSchemaFullText(result.fullText ?? null);

            setStatus("schema_detecting");
            const ai = getAIProvider();
            const rawSchema = await ai.detectSchema(result.sanitizedSample!);

            if (!rawSchema) {
              setError("Failed to detect statement format. Try a different file.");
              setStatus("idle");
              return;
            }

            const schema = buildSchema(rawSchema, result.fingerprint!);
            setDetectedSchema(schema);

            // Preview: parse first 5 rows for validation
            const preview = parseWithSchema(
              result.items!,
              result.fullText!,
              { ...schema, id: "", user_id: "", created_at: "" } as StatementSchema,
              { limit: 5 },
            );
            setSchemaPreview(preview.transactions);
            setStatus("schema_validating");
          }
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

  const confirmSchema = useCallback(async () => {
    if (!detectedSchema || !schemaItems || !schemaFullText) return;

    try {
      const saved = await saveSchema(detectedSchema);

      setStatus("parsing");
      const fullSchema = {
        ...detectedSchema,
        id: saved.id,
        user_id: saved.user_id,
        created_at: saved.created_at,
      } as StatementSchema;
      const result = parseWithSchema(schemaItems, schemaFullText, fullSchema);
      const validation = validateTransactions(result.transactions, result.rawLines);
      setValidationResult(validation);

      const allTx = [...validation.clean, ...validation.flagged];
      if (allTx.length === 0) {
        setError("No transactions found after parsing with detected schema.");
        setStatus("idle");
        return;
      }

      setWarnings(result.warnings);
      await processTransactions(allTx);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schema");
      setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedSchema, schemaItems, schemaFullText]);

  const rejectSchema = useCallback(() => {
    setDetectedSchema(null);
    setSchemaPreview(null);
    setSchemaItems(null);
    setSchemaFullText(null);
    setStatus("idle");
  }, []);

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

      // Invalidate caches so the UI reflects new data without a page reload
      queryClient.invalidateQueries({ queryKey: merchantMappingKeys.all });

      setProgress(100);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import transactions");
      setStatus("reviewing");
    }
  }, [items, merchantMappings, queryClient]);

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus("idle");
    setItems([]);
    setWarnings([]);
    setError(null);
    setProgress(0);
    setCsvHeaders([]);
    setCsvRows([]);
    setDetectedSchema(null);
    setSchemaPreview(null);
    setSchemaItems(null);
    setSchemaFullText(null);
    setValidationResult(null);
    setFlaggedFirst(false);
  }, []);

  return {
    status,
    items,
    warnings,
    error,
    progress,
    csvHeaders,
    schemaPreview,
    detectedSchema,
    validationResult,
    flaggedFirst,
    setFlaggedFirst,
    handleFile,
    handleCsvMapping,
    confirmSchema,
    rejectSchema,
    updateItem,
    acceptAll,
    commit,
    reset,
  };
}
