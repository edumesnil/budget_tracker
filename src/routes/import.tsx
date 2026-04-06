import { useState } from "react";
import { css } from "../../styled-system/css";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCategories } from "@/hooks/use-categories";
import { useMerchantMappings, merchantMappingKeys } from "@/hooks/use-merchant-mappings";
import { transactionKeys } from "@/hooks/use-transactions";
import { useImport } from "@/hooks/use-import";
import { FileUpload } from "@/components/import/file-upload";
import { ColumnMapper } from "@/components/import/column-mapper";
import { ReviewTable } from "@/components/import/review-table";
import { ImportStepper, type Step } from "@/components/import/import-stepper";
import { SchemaDetectingCard } from "@/components/import/schema-detecting-card";
import { SchemaValidationCard } from "@/components/import/schema-validation-card";
import { ValidationSummaryCard } from "@/components/import/validation-summary-card";
import { UnparseableSection } from "@/components/import/unparseable-section";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { Button } from "@/components/ui/button";
import * as Card from "@/components/ui/card";
import * as Progress from "@/components/ui/progress";
import { Toaster } from "@/components/ui/toast";
import { toaster } from "@/lib/toaster";
import { CheckCircle, AlertTriangle, Trash2 } from "lucide-react";

export default function ImportPage() {
  const queryClient = useQueryClient();
  const { groups, allCategories, createCategory } = useCategories();
  const { mappings } = useMerchantMappings();
  const [clearing, setClearing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Category creation dialog triggered from the review table
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catPrefill, setCatPrefill] = useState<{ name?: string; groupId?: string | null }>({});

  const handleCreateCategory = (prefill: { name?: string; groupId?: string | null }) => {
    setCatPrefill(prefill);
    setCatDialogOpen(true);
  };

  const {
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
    schemaPreview,
    detectedSchema,
    confirmSchema,
    rejectSchema,
    validationResult,
    flaggedFirst,
    setFlaggedFirst,
  } = useImport(allCategories, groups, mappings);

  const handleClearData = async () => {
    if (!window.confirm("Delete all transactions and merchant mappings? This cannot be undone."))
      return;
    setClearing(true);
    try {
      await supabase
        .from("transactions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase
        .from("merchant_mappings")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: merchantMappingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      toaster.success({ title: "Cleared all transactions and merchant mappings" });
    } catch {
      toaster.error({ title: "Failed to clear data" });
    } finally {
      setClearing(false);
    }
  };

  const handleCommit = async () => {
    const ok = await commit();
    if (ok) {
      toaster.success({
        title: "Import complete",
        description: `${items.filter((i) => i.status === "accepted").length} transactions imported.`,
      });
    }
  };

  const stepperSteps: Step[] = (() => {
    const isFirstTime =
      status === "schema_detecting" || status === "schema_validating" || detectedSchema !== null;

    if (isFirstTime) {
      return [
        {
          label: "Extract",
          status: (status === "parsing"
            ? "active"
            : status === "idle"
              ? "pending"
              : "completed") as Step["status"],
        },
        {
          label: "Detect format",
          status: (status === "schema_detecting"
            ? "active"
            : ["schema_validating", "reviewing", "importing", "done"].includes(status)
              ? "completed"
              : "pending") as Step["status"],
        },
        {
          label: "Confirm format",
          status: (status === "schema_validating"
            ? "active"
            : ["reviewing", "importing", "done"].includes(status)
              ? "completed"
              : "pending") as Step["status"],
        },
        {
          label: "Review",
          status: (status === "reviewing"
            ? "active"
            : ["importing", "done"].includes(status)
              ? "completed"
              : "pending") as Step["status"],
        },
        {
          label: "Import",
          status: (status === "importing"
            ? "active"
            : status === "done"
              ? "completed"
              : "pending") as Step["status"],
        },
      ];
    }

    return [
      {
        label: "Extract",
        status: (status === "parsing"
          ? "active"
          : status === "idle"
            ? "pending"
            : "completed") as Step["status"],
      },
      {
        label: "Review",
        status: (status === "reviewing"
          ? "active"
          : ["importing", "done"].includes(status)
            ? "completed"
            : "pending") as Step["status"],
      },
      {
        label: "Import",
        status: (status === "importing"
          ? "active"
          : status === "done"
            ? "completed"
            : "pending") as Step["status"],
      },
    ];
  })();

  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "6" })}>
      {/* Page header */}
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        })}
      >
        <div>
          <h1
            className={css({
              fontSize: "xl",
              fontWeight: "600",
              color: "fg.default",
              letterSpacing: "tight",
            })}
          >
            Import
          </h1>
          <p className={css({ color: "fg.muted", mt: "0.5", fontSize: "sm" })}>
            Upload a bank statement to auto-categorize transactions.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearData}
          loading={clearing}
          className={css({ color: "fg.muted" })}
        >
          <Trash2 size={14} />
          Clear transactions + mappings
        </Button>
      </div>

      {/* Stepper — shown during active import */}
      {status !== "idle" && <ImportStepper steps={stepperSteps} />}

      {/* Error display */}
      {error && (
        <Card.Root>
          <Card.Body
            className={css({
              pt: "6",
              display: "flex",
              alignItems: "center",
              gap: "3",
              color: "expense",
            })}
          >
            <AlertTriangle size={16} />
            <span className={css({ fontSize: "sm" })}>{error}</span>
            <Button variant="outline" size="sm" onClick={reset} className={css({ ml: "auto" })}>
              Try again
            </Button>
          </Card.Body>
        </Card.Root>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card.Root>
          <Card.Body
            className={css({
              pt: "6",
              display: "flex",
              flexDir: "column",
              gap: "1",
            })}
          >
            {warnings.map((w, i) => (
              <div
                key={i}
                className={css({
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "2",
                  fontSize: "xs",
                  color: "fg.muted",
                })}
              >
                <AlertTriangle size={12} className={css({ flexShrink: 0, mt: "0.5" })} />
                <span>{w}</span>
              </div>
            ))}
          </Card.Body>
        </Card.Root>
      )}

      {/* Idle: show file upload */}
      {status === "idle" && <FileUpload onFile={handleFile} />}

      {/* Parsing: show progress */}
      {status === "parsing" && (
        <Card.Root>
          <Card.Body
            className={css({
              pt: "6",
              display: "flex",
              flexDir: "column",
              gap: "3",
              alignItems: "center",
              py: "12",
            })}
          >
            <p className={css({ fontSize: "sm", color: "fg.muted" })}>Parsing statement...</p>
            <div className={css({ w: "full", maxW: "xs" })}>
              <Progress.Root value={progress}>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </div>
          </Card.Body>
        </Card.Root>
      )}

      {/* Schema detecting: AI analyzing format */}
      {status === "schema_detecting" && <SchemaDetectingCard />}

      {/* Schema validating: user confirms sample rows */}
      {status === "schema_validating" && schemaPreview && detectedSchema && (
        <SchemaValidationCard
          bankName={detectedSchema.bank_name}
          statementType={detectedSchema.statement_type}
          preview={schemaPreview}
          onConfirm={async () => {
            setConfirming(true);
            try {
              await confirmSchema();
            } finally {
              setConfirming(false);
            }
          }}
          onReject={rejectSchema}
          isConfirming={confirming}
        />
      )}

      {/* CSV column mapping */}
      {status === "mapping" && (
        <ColumnMapper headers={csvHeaders} onSubmit={handleCsvMapping} onCancel={reset} />
      )}

      {/* Validation summary — shown above review table when there are flagged/unparseable rows */}
      {status === "reviewing" &&
        validationResult &&
        (validationResult.flagged.length > 0 || validationResult.unparseable.length > 0) && (
          <ValidationSummaryCard
            bankName={detectedSchema?.bank_name ?? ""}
            statementType={detectedSchema?.statement_type ?? ""}
            totalCount={items.length}
            cleanCount={validationResult.clean.length}
            flaggedCount={validationResult.flagged.length}
            unparseableCount={validationResult.unparseable.length}
            knownCount={items.filter((i) => i.confidence === "known").length}
            pendingAiCount={items.filter((i) => i.aiStatus === "waiting").length}
            onReviewAll={() => setFlaggedFirst(false)}
            onShowFlaggedFirst={() => setFlaggedFirst(true)}
          />
        )}

      {/* Review */}
      {status === "reviewing" && (
        <>
          <ReviewTable
            items={
              flaggedFirst
                ? [...items].sort((a, b) => (b.warnings?.length ?? 0) - (a.warnings?.length ?? 0))
                : items
            }
            groups={groups}
            onUpdateItem={updateItem}
            onAcceptAll={acceptAll}
            onCommit={handleCommit}
            onCancel={reset}
            isCommitting={status === "importing"}
            onCreateCategory={handleCreateCategory}
          />
          {validationResult && validationResult.unparseable.length > 0 && (
            <UnparseableSection rows={validationResult.unparseable} />
          )}
        </>
      )}

      {/* Category creation dialog (triggered from review table) */}
      <CategoryFormDialog
        open={catDialogOpen}
        onOpenChange={setCatDialogOpen}
        category={null}
        groups={groups}
        defaultGroupId={catPrefill.groupId ?? null}
        defaultName={catPrefill.name}
        onSubmit={async (data) => {
          const created = await createCategory.mutateAsync(data);
          // Assign the new category to all review items whose suggestedCategory
          // matches the prefill name that opened this dialog
          const prefillLower = catPrefill.name?.toLowerCase();
          if (prefillLower) {
            for (const item of items) {
              if (item.suggestedCategory?.toLowerCase() === prefillLower && !item.category_id) {
                updateItem(item.id, {
                  category_id: created.id,
                  confidence: "high",
                  suggestedCategory: undefined,
                });
              }
            }
          }
          setCatDialogOpen(false);
          toaster.success({ title: `Category "${data.name}" created` });
        }}
        isSubmitting={createCategory.isPending}
      />

      {/* Importing: show progress */}
      {status === "importing" && (
        <Card.Root>
          <Card.Body
            className={css({
              pt: "6",
              display: "flex",
              flexDir: "column",
              gap: "3",
              alignItems: "center",
              py: "12",
            })}
          >
            <p className={css({ fontSize: "sm", color: "fg.muted" })}>Importing transactions...</p>
            <div className={css({ w: "full", maxW: "xs" })}>
              <Progress.Root value={progress}>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </div>
          </Card.Body>
        </Card.Root>
      )}

      {/* Done */}
      {status === "done" && (
        <Card.Root>
          <Card.Body
            className={css({
              pt: "6",
              display: "flex",
              flexDir: "column",
              gap: "3",
              alignItems: "center",
              py: "12",
            })}
          >
            <CheckCircle size={32} className={css({ color: "income" })} />
            <p className={css({ fontSize: "sm", fontWeight: "500", color: "fg.default" })}>
              Import complete
            </p>
            <p className={css({ fontSize: "sm", color: "fg.muted" })}>
              {items.filter((i) => i.status === "accepted").length} transactions imported.{" "}
              {items.filter((i) => i.status === "skipped").length} skipped.
            </p>
            <Button variant="outline" size="sm" onClick={reset}>
              Import another statement
            </Button>
          </Card.Body>
        </Card.Root>
      )}

      <Toaster />
    </div>
  );
}
