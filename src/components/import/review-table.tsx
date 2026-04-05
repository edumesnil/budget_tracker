import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createListCollection } from "@ark-ui/react/collection";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertTriangle, Sparkles, Database, HelpCircle, Plus } from "lucide-react";
import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import * as Table from "@/components/ui/table";
import * as Select from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ReviewItem } from "@/hooks/use-import";
import type { GroupWithCategories } from "@/hooks/use-categories";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReviewTableProps {
  items: ReviewItem[];
  groups: GroupWithCategories[];
  onUpdateItem: (id: string, updates: Partial<ReviewItem>) => void;
  onAcceptAll: () => void;
  onCommit: () => void;
  onCancel: () => void;
  isCommitting: boolean;
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: ReviewItem["confidence"] }) {
  const config = {
    known: { icon: Database, label: "Known", color: "fg.default", bg: "colorPalette.3" },
    high: { icon: Sparkles, label: "High", color: "income", bg: "income.muted" },
    medium: { icon: Sparkles, label: "Medium", color: "fg.muted", bg: "bg.subtle" },
    low: { icon: HelpCircle, label: "Low", color: "expense", bg: "expense.muted" },
  };
  const c = config[confidence];
  const Icon = c.icon;

  return (
    <span
      className={css({
        display: "inline-flex",
        alignItems: "center",
        gap: "1",
        px: "1.5",
        py: "0.5",
        rounded: "sm",
        fontSize: "xs",
        fontWeight: "500",
        color: c.color,
        bg: c.bg,
      })}
    >
      <Icon size={12} />
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AI status indicator (shown in the Confidence column)
// ---------------------------------------------------------------------------

function AiStatusCell({ item }: { item: ReviewItem }) {
  // "done" with confidence badge — animate in on first render of this state
  if (item.aiStatus === "done" || item.aiStatus === "skipped") {
    return (
      <motion.span
        key={`badge-${item.id}`}
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >
        <ConfidenceBadge confidence={item.confidence} />
      </motion.span>
    );
  }

  if (item.aiStatus === "analyzing") {
    return (
      <span
        className={css({
          display: "inline-flex",
          alignItems: "center",
          gap: "1",
          px: "1.5",
          py: "0.5",
          rounded: "sm",
          fontSize: "xs",
          fontWeight: "500",
          color: "blue.11",
          bg: "blue.3",
        })}
      >
        <Spinner size="xs" />
        Analyzing
      </span>
    );
  }

  // waiting — minimal, the row opacity already signals this
  return <span className={css({ fontSize: "xs", color: "fg.disabled" })}>—</span>;
}

// ---------------------------------------------------------------------------
// Animated category cell content
// ---------------------------------------------------------------------------

function CategoryContent({
  item,
  getCategoryName,
}: {
  item: ReviewItem;
  getCategoryName: (id: string | null) => string;
}) {
  if (item.category_id === null && item.suggestedCategory) {
    return (
      <span
        className={css({
          display: "inline-flex",
          alignItems: "center",
          gap: "1",
          px: "1.5",
          py: "0.5",
          rounded: "sm",
          fontSize: "xs",
          fontWeight: "500",
          color: "colorPalette.fg",
          bg: "colorPalette.3",
        })}
      >
        <Plus size={11} />
        {item.suggestedCategory}
      </span>
    );
  }

  return (
    <span
      className={css({
        fontSize: "sm",
        color: item.category_id ? "fg.default" : "fg.muted",
        fontStyle: item.category_id ? "normal" : "italic",
      })}
    >
      {getCategoryName(item.category_id)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Animated row — wraps Table.Row with framer-motion for background flash
// ---------------------------------------------------------------------------

const MotionTr = motion.tr;

interface AnimatedRowProps {
  item: ReviewItem;
  idx: number;
  isActive: boolean;
  isEditing: boolean;
  categoryCollection: ReturnType<typeof createListCollection>;
  groups: GroupWithCategories[];
  getCategoryName: (id: string | null) => string;
  onClickRow: (idx: number) => void;
  onUpdateItem: (id: string, updates: Partial<ReviewItem>) => void;
  onEditingClose: () => void;
}

function AnimatedRow({
  item,
  idx,
  isActive,
  isEditing,
  categoryCollection,
  groups,
  getCategoryName,
  onClickRow,
  onUpdateItem,
  onEditingClose,
}: AnimatedRowProps) {
  // Track previous aiStatus to detect the "done" transition
  const prevAiStatus = useRef(item.aiStatus);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (prevAiStatus.current !== "done" && item.aiStatus === "done") {
      setFlashKey((k) => k + 1);
    }
    prevAiStatus.current = item.aiStatus;
  }, [item.aiStatus]);

  // Track previous category_id to animate category cell on AI update
  const prevCategoryId = useRef(item.category_id);
  const [categoryAnimKey, setCategoryAnimKey] = useState(0);

  useEffect(() => {
    if (prevCategoryId.current !== item.category_id && item.aiStatus === "done") {
      setCategoryAnimKey((k) => k + 1);
    }
    prevCategoryId.current = item.category_id;
  }, [item.category_id, item.aiStatus]);

  // Track previous displayName to animate description on AI update
  const prevDisplayName = useRef(item.displayName);
  const [displayNameAnimKey, setDisplayNameAnimKey] = useState(0);

  useEffect(() => {
    if (prevDisplayName.current !== item.displayName) {
      setDisplayNameAnimKey((k) => k + 1);
    }
    prevDisplayName.current = item.displayName;
  }, [item.displayName]);

  const rowBg = isActive ? "var(--colors-color-palette-2)" : "transparent";

  return (
    <MotionTr
      key={item.id}
      data-row-idx={idx}
      onClick={() => onClickRow(idx)}
      // Flash the background when AI result arrives
      animate={
        flashKey > 0
          ? {
              backgroundColor: [rowBg, "var(--colors-color-palette-3)", rowBg],
            }
          : { backgroundColor: rowBg }
      }
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={css({
        cursor: "pointer",
        opacity:
          item.status === "skipped"
            ? 0.4
            : item.aiStatus === "waiting" || item.aiStatus === "analyzing"
              ? 0.45
              : 1,
        transition: "opacity 200ms",
        _hover: { bg: "bg.subtle" },
        ...(item.aiStatus === "analyzing" && {
          boxShadow: "inset 3px 0 0 0 var(--colors-color-palette-8)",
        }),
      })}
      style={{ backgroundColor: rowBg }}
    >
      {/* Status icon */}
      <Table.Cell>
        {item.status === "accepted" && <Check size={14} className={css({ color: "income" })} />}
        {item.status === "skipped" && <X size={14} className={css({ color: "fg.muted" })} />}
      </Table.Cell>

      {/* Date */}
      <Table.Cell className={css({ fontSize: "xs", whiteSpace: "nowrap" })}>
        {formatDate(item.date)}
      </Table.Cell>

      {/* Description */}
      <Table.Cell>
        <div>
          <AnimatePresence mode="wait">
            <motion.span
              key={`dn-${item.id}-${displayNameAnimKey}`}
              initial={displayNameAnimKey > 0 ? { opacity: 0, y: -4 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={css({ display: "block", fontSize: "sm", fontWeight: "500" })}
            >
              {item.displayName}
            </motion.span>
          </AnimatePresence>
          <p className={css({ fontSize: "xs", color: "fg.muted", mt: "0.5" })}>
            {item.description}
          </p>
          {item.duplicate && (
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "1",
                mt: "0.5",
              })}
            >
              <AlertTriangle size={12} className={css({ color: "expense" })} />
              <span className={css({ fontSize: "xs", color: "expense" })}>
                Possible duplicate: {item.duplicate.description ?? "manual entry"} on{" "}
                {formatDate(item.duplicate.date)}
              </span>
            </div>
          )}
        </div>
      </Table.Cell>

      {/* Amount */}
      <Table.Cell
        className={css({
          textAlign: "right",
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          color: item.type === "INCOME" ? "income" : "expense",
        })}
      >
        {item.type === "INCOME" ? "+" : "−"}
        {formatCurrency(item.amount)}
      </Table.Cell>

      {/* Category */}
      <Table.Cell className={css({ overflow: "visible", pos: "relative" })}>
        {isEditing ? (
          <Select.Root
            collection={categoryCollection}
            value={item.category_id ? [item.category_id] : []}
            onValueChange={(d: { value: string[] }) => {
              const val = d.value[0];
              if (val) {
                onUpdateItem(item.id, { category_id: val, confidence: "high" });
              }
              onEditingClose();
            }}
            onOpenChange={(d: { open: boolean }) => {
              if (!d.open) onEditingClose();
            }}
            open
            positioning={{ placement: "bottom-start", sameWidth: false }}
          >
            <Select.Control>
              <Select.Trigger className={css({ w: "full", maxW: "full" })}>
                <Select.ValueText placeholder="Select" />
                <Select.Indicator />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content className={css({ maxH: "48", overflowY: "auto", minW: "48" })}>
                {groups
                  .filter((g) => g.id !== "__ungrouped__")
                  .map((g) => (
                    <Select.ItemGroup key={g.id}>
                      <Select.ItemGroupLabel>{g.name}</Select.ItemGroupLabel>
                      {g.categories.map((cat) => (
                        <Select.Item key={cat.id} item={{ label: cat.name, value: cat.id }}>
                          <Select.ItemText>{cat.name}</Select.ItemText>
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.ItemGroup>
                  ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        ) : (
          <AnimatePresence mode="wait">
            <motion.span
              key={`cat-${item.id}-${categoryAnimKey}`}
              initial={categoryAnimKey > 0 ? { opacity: 0, x: -6 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ display: "inline-block" }}
            >
              <CategoryContent item={item} getCategoryName={getCategoryName} />
            </motion.span>
          </AnimatePresence>
        )}
      </Table.Cell>

      {/* AI status / Confidence */}
      <Table.Cell>
        <AnimatePresence mode="wait">
          <motion.span
            key={`ai-${item.id}-${item.aiStatus}`}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ display: "inline-block" }}
          >
            <AiStatusCell item={item} />
          </motion.span>
        </AnimatePresence>
      </Table.Cell>

      {/* Duplicate warning icon */}
      <Table.Cell>
        {item.duplicate && <AlertTriangle size={14} className={css({ color: "expense" })} />}
      </Table.Cell>
    </MotionTr>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewTable({
  items,
  groups,
  onUpdateItem,
  onAcceptAll,
  onCommit,
  onCancel,
  isCommitting,
}: ReviewTableProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Category collection for the select dropdown
  const categoryItems = useMemo(() => {
    const result: { label: string; value: string; group: string }[] = [];
    for (const g of groups) {
      if (g.id === "__ungrouped__") continue;
      for (const cat of g.categories) {
        result.push({ label: cat.name, value: cat.id, group: g.name });
      }
    }
    const ungrouped = groups.find((g) => g.id === "__ungrouped__");
    if (ungrouped) {
      for (const cat of ungrouped.categories) {
        result.push({ label: cat.name, value: cat.id, group: "Ungrouped" });
      }
    }
    return result;
  }, [groups]);

  const categoryCollection = useMemo(
    () => createListCollection({ items: categoryItems }),
    [categoryItems],
  );

  // Stats
  const accepted = items.filter((i) => i.status === "accepted").length;
  const skipped = items.filter((i) => i.status === "skipped").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const dupeCount = items.filter((i) => i.duplicate).length;

  // AI progress
  const aiDone = items.filter((i) => i.aiStatus === "done" || i.aiStatus === "skipped").length;
  const aiTotal = items.length;
  const aiRemaining = items.filter(
    (i) => i.aiStatus === "waiting" || i.aiStatus === "analyzing",
  ).length;
  const isAiRunning = aiRemaining > 0;

  // Scroll active row into view
  useEffect(() => {
    const row = containerRef.current?.querySelector(`[data-row-idx="${activeIdx}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingIdx !== null) return;

      const item = items[activeIdx];
      if (!item) return;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          setActiveIdx((i) => Math.min(i + 1, items.length - 1));
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          setActiveIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (item.category_id) {
            onUpdateItem(item.id, { status: "accepted" });
            setActiveIdx((i) => Math.min(i + 1, items.length - 1));
          }
          break;
        case "d":
        case "D":
          e.preventDefault();
          onUpdateItem(item.id, { status: "skipped" });
          setActiveIdx((i) => Math.min(i + 1, items.length - 1));
          break;
        case "Tab":
          e.preventDefault();
          setEditingIdx(activeIdx);
          break;
        case "u":
        case "U":
          e.preventDefault();
          onUpdateItem(item.id, { status: "pending" });
          break;
      }
    },
    [activeIdx, items, editingIdx, onUpdateItem],
  );

  const getCategoryName = (catId: string | null): string => {
    if (!catId) return "Uncategorized";
    for (const g of groups) {
      const cat = g.categories.find((c) => c.id === catId);
      if (cat) return cat.name;
    }
    return "Unknown";
  };

  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "4" })}>
      {/* Stats bar */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "4",
          flexWrap: "wrap",
        })}
      >
        <span className={css({ fontSize: "sm", color: "fg.muted" })}>
          {items.length} transactions
        </span>
        <span className={css({ fontSize: "sm", color: "income" })}>{accepted} accepted</span>
        <span className={css({ fontSize: "sm", color: "fg.muted" })}>{skipped} skipped</span>
        <span className={css({ fontSize: "sm", color: "fg.muted" })}>{pending} pending</span>
        {dupeCount > 0 && (
          <span className={css({ fontSize: "sm", color: "expense" })}>
            {dupeCount} possible duplicates
          </span>
        )}

        {/* AI categorization progress */}
        <AnimatePresence>
          {isAiRunning && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className={css({
                display: "inline-flex",
                alignItems: "center",
                gap: "2",
                fontSize: "sm",
                color: "colorPalette.fg",
                overflow: "hidden",
                whiteSpace: "nowrap",
              })}
            >
              <Spinner size="xs" />
              <span>
                Categorizing… {aiRemaining}/{aiTotal} remaining
              </span>
              {/* inline progress track */}
              <span
                className={css({
                  display: "inline-block",
                  w: "16",
                  h: "1",
                  rounded: "full",
                  bg: "bg.subtle",
                  overflow: "hidden",
                })}
              >
                <motion.span
                  className={css({
                    display: "block",
                    h: "full",
                    rounded: "full",
                    bg: "colorPalette.9",
                  })}
                  animate={{ width: `${(aiDone / aiTotal) * 100}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{ width: 0 }}
                />
              </span>
            </motion.span>
          )}
        </AnimatePresence>

        <div className={css({ ml: "auto", display: "flex", gap: "2" })}>
          <Button variant="outline" size="sm" onClick={onAcceptAll}>
            Accept all categorized
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onCommit} disabled={accepted === 0} loading={isCommitting}>
            Import {accepted} transactions
          </Button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className={css({ display: "flex", gap: "3", flexWrap: "wrap" })}>
        {[
          { key: "↑↓", desc: "navigate" },
          { key: "Enter", desc: "accept" },
          { key: "Tab", desc: "change category" },
          { key: "D", desc: "skip" },
          { key: "U", desc: "undo" },
        ].map(({ key, desc }) => (
          <span key={key} className={css({ fontSize: "xs", color: "fg.muted" })}>
            <kbd
              className={css({
                display: "inline-block",
                px: "1.5",
                py: "0.5",
                rounded: "sm",
                bg: "bg.subtle",
                fontSize: "xs",
                fontWeight: "500",
                mr: "1",
              })}
            >
              {key}
            </kbd>
            {desc}
          </span>
        ))}
      </div>

      {/* Review table */}
      <Card.Root>
        <Card.Body className={css({ pt: "0", px: "0", pb: "0" })}>
          <div
            ref={containerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className={css({
              outline: "none",
              maxH: "2xl",
              overflowY: "auto",
            })}
          >
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header className={css({ w: "8" })} />
                  <Table.Header className={css({ w: "32", minW: "32" })}>Date</Table.Header>
                  <Table.Header>Description</Table.Header>
                  <Table.Header className={css({ textAlign: "right", w: "24", minW: "24" })}>
                    Amount
                  </Table.Header>
                  <Table.Header className={css({ w: "40", minW: "40" })}>Category</Table.Header>
                  <Table.Header className={css({ w: "28", minW: "28" })}>Status</Table.Header>
                  <Table.Header className={css({ w: "8" })} />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {items.map((item, idx) => (
                  <AnimatedRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    isActive={idx === activeIdx}
                    isEditing={editingIdx === idx}
                    categoryCollection={categoryCollection}
                    groups={groups}
                    getCategoryName={getCategoryName}
                    onClickRow={setActiveIdx}
                    onUpdateItem={onUpdateItem}
                    onEditingClose={() => setEditingIdx(null)}
                  />
                ))}
              </Table.Body>
            </Table.Root>
          </div>
        </Card.Body>
      </Card.Root>
    </div>
  );
}
