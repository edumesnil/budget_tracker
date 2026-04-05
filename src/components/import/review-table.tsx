import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Database,
  HelpCircle,
  Plus,
} from "lucide-react";
import { css } from "../../../styled-system/css";
import { Badge } from "@/components/ui/badge";
import * as Card from "@/components/ui/card";
import * as Table from "@/components/ui/table";
import { Input } from "@/components/ui/input";
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
  onCreateCategory: (prefill: { name?: string; groupId?: string | null }) => void;
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
    <Badge
      size="sm"
      variant="subtle"
      className={css({
        color: c.color,
        bg: c.bg,
        borderColor: "transparent",
      })}
    >
      <Icon size={12} />
      {c.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// AI status indicator (shown in the Confidence column)
// ---------------------------------------------------------------------------

function AiStatusCell({ item }: { item: ReviewItem }) {
  if (item.aiStatus === "done" || item.aiStatus === "skipped") {
    return (
      <span
        className={css({
          display: "inline-block",
          animation: "slide-fade-in-x 200ms ease-out",
        })}
      >
        <ConfidenceBadge confidence={item.confidence} />
      </span>
    );
  }

  if (item.aiStatus === "analyzing") {
    return (
      <Badge
        size="sm"
        variant="subtle"
        className={css({
          color: "blue.11",
          bg: "blue.3",
          borderColor: "transparent",
        })}
      >
        <Spinner size="xs" />
        Analyzing
      </Badge>
    );
  }

  return <span className={css({ fontSize: "xs", color: "fg.disabled" })}>—</span>;
}

// ---------------------------------------------------------------------------
// Animated category cell content
// ---------------------------------------------------------------------------

function CategoryContent({
  item,
  getCategoryName,
  onSuggestedClick,
}: {
  item: ReviewItem;
  getCategoryName: (id: string | null) => string;
  onSuggestedClick?: (e: React.MouseEvent) => void;
}) {
  if (item.category_id === null && item.suggestedCategory) {
    return (
      <span
        onClick={onSuggestedClick}
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
          cursor: "pointer",
          _hover: { bg: "colorPalette.4" },
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
        cursor: "pointer",
      })}
    >
      {getCategoryName(item.category_id)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Category picker — popover with search + grouped list + create option
// No cell morphing: the category text is the anchor, panel floats above
// ---------------------------------------------------------------------------

function CategoryPicker({
  item,
  groups,
  onSelect,
  onClose,
  onCreateCategory,
}: {
  item: ReviewItem;
  groups: GroupWithCategories[];
  onSelect: (catId: string) => void;
  onClose: () => void;
  onCreateCategory: (prefill: { name?: string; groupId?: string | null }) => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when opened
  useEffect(() => {
    // Small delay to let the popover render
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Build grouped + filtered list
  const groupedItems = useMemo(() => {
    const q = search.toLowerCase();
    const map = new Map<string, Array<{ id: string; name: string }>>();

    for (const g of groups) {
      if (g.id === "__ungrouped__") continue;
      const cats = g.categories.filter((c) => !q || c.name.toLowerCase().includes(q));
      if (cats.length > 0) map.set(g.name, cats);
    }

    const ungrouped = groups.find((g) => g.id === "__ungrouped__");
    if (ungrouped) {
      const cats = ungrouped.categories.filter((c) => !q || c.name.toLowerCase().includes(q));
      if (cats.length > 0) map.set("Ungrouped", cats);
    }

    return map;
  }, [groups, search]);

  const totalResults = useMemo(
    () => [...groupedItems.values()].reduce((sum, cats) => sum + cats.length, 0),
    [groupedItems],
  );

  return (
    <div
      className={css({
        pos: "absolute",
        top: "100%",
        left: 0,
        zIndex: 50,
        mt: "1",
        w: "56",
        bg: "bg.default",
        rounded: "lg",
        shadow: "lg",
        display: "flex",
        flexDir: "column",
        overflow: "hidden",
      })}
    >
      {/* Search input */}
      <div className={css({ p: "2" })}>
        <Input
          ref={inputRef}
          size="sm"
          placeholder="Search..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onClose();
            }
          }}
        />
      </div>

      {/* Category list */}
      <div className={css({ maxH: "56", overflowY: "auto", px: "1", pb: "1" })}>
        {Array.from(groupedItems.entries()).map(([groupName, cats]) => (
          <div key={groupName}>
            <div
              className={css({
                px: "2",
                py: "1",
                fontSize: "xs",
                fontWeight: "600",
                color: "fg.muted",
                textTransform: "uppercase",
                letterSpacing: "wide",
              })}
            >
              {groupName}
            </div>
            {cats.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(cat.id);
                  onClose();
                }}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "2",
                  w: "full",
                  px: "2",
                  py: "1.5",
                  rounded: "md",
                  fontSize: "sm",
                  color: cat.id === item.category_id ? "colorPalette.11" : "fg.default",
                  bg: cat.id === item.category_id ? "colorPalette.3" : "transparent",
                  fontWeight: cat.id === item.category_id ? "500" : "400",
                  cursor: "pointer",
                  border: "none",
                  textAlign: "left",
                  _hover: { bg: "gray.a3" },
                  transition: "background 100ms",
                })}
              >
                {cat.name}
                {cat.id === item.category_id && <Check size={14} />}
              </button>
            ))}
          </div>
        ))}

        {totalResults === 0 && (
          <div
            className={css({
              px: "2",
              py: "3",
              fontSize: "sm",
              color: "fg.muted",
              textAlign: "center",
            })}
          >
            No categories found
          </div>
        )}
      </div>

      {/* Create new */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCreateCategory({ name: search || undefined });
          onClose();
        }}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "1.5",
          w: "full",
          px: "3",
          py: "2",
          fontSize: "sm",
          fontWeight: "500",
          color: "colorPalette.11",
          bg: "transparent",
          cursor: "pointer",
          border: "none",
          borderTopWidth: "1px",
          borderColor: "border.subtle",
          textAlign: "left",
          _hover: { bg: "colorPalette.2" },
        })}
      >
        <Plus size={14} />
        Create new category
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated row — CSS animations replace framer-motion
// ---------------------------------------------------------------------------

interface AnimatedRowProps {
  item: ReviewItem;
  idx: number;
  isActive: boolean;
  isEditing: boolean;
  groups: GroupWithCategories[];
  getCategoryName: (id: string | null) => string;
  onClickRow: (idx: number) => void;
  onClickCategory: (idx: number) => void;
  onUpdateItem: (id: string, updates: Partial<ReviewItem>) => void;
  onEditingClose: () => void;
  onCreateCategory: (prefill: { name?: string; groupId?: string | null }) => void;
}

const AnimatedRow = memo(function AnimatedRow({
  item,
  idx,
  isActive,
  isEditing,
  groups,
  getCategoryName,
  onClickRow,
  onClickCategory,
  onUpdateItem,
  onEditingClose,
  onCreateCategory,
}: AnimatedRowProps) {
  const prevAiStatus = useRef(item.aiStatus);
  const [flashActive, setFlashActive] = useState(false);

  useEffect(() => {
    if (prevAiStatus.current !== "done" && item.aiStatus === "done") {
      setFlashActive(true);
    }
    prevAiStatus.current = item.aiStatus;
  }, [item.aiStatus]);

  const prevCategoryId = useRef(item.category_id);
  const [categoryAnimKey, setCategoryAnimKey] = useState(0);

  useEffect(() => {
    if (prevCategoryId.current !== item.category_id && item.aiStatus === "done") {
      setCategoryAnimKey((k) => k + 1);
    }
    prevCategoryId.current = item.category_id;
  }, [item.category_id, item.aiStatus]);

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
    <tr
      data-row-idx={idx}
      onClick={() => onClickRow(idx)}
      onAnimationEnd={() => setFlashActive(false)}
      className={css({
        cursor: "pointer",
        opacity:
          item.status === "skipped"
            ? 0.4
            : item.aiStatus === "waiting" || item.aiStatus === "analyzing"
              ? 0.45
              : 1,
        transition: "opacity 200ms",
        _hover: { bg: "gray.a2" },
        ...(item.aiStatus === "analyzing" && {
          boxShadow: "inset 3px 0 0 0 var(--colors-color-palette-8)",
        }),
        ...(flashActive && {
          animation: "flash-row 400ms ease-out",
        }),
      })}
      style={{
        backgroundColor: rowBg,
        ["--flash-bg" as string]: "var(--colors-color-palette-3)",
      }}
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
          <span
            key={`dn-${item.id}-${displayNameAnimKey}`}
            className={css({
              display: "block",
              fontSize: "sm",
              fontWeight: "500",
              ...(displayNameAnimKey > 0 && {
                animation: "slide-fade-in-y 200ms ease-out",
              }),
            })}
          >
            {item.displayName}
          </span>
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
      <Table.Cell
        className={css({ overflow: "visible", pos: "relative", cursor: "pointer" })}
        onClick={(e) => {
          e.stopPropagation();
          onClickRow(idx);
          onClickCategory(idx);
        }}
      >
        <span
          key={`cat-${item.id}-${categoryAnimKey}`}
          className={css({
            display: "inline-block",
            ...(categoryAnimKey > 0 && {
              animation: "slide-fade-in-x 250ms ease-out",
            }),
          })}
        >
          <CategoryContent
            item={item}
            getCategoryName={getCategoryName}
            onSuggestedClick={(e) => {
              e.stopPropagation();
              onCreateCategory({ name: item.suggestedCategory ?? undefined });
            }}
          />
        </span>

        {/* Floating picker — overlays below the cell */}
        {isEditing && (
          <CategoryPicker
            item={item}
            groups={groups}
            onSelect={(catId) => {
              onUpdateItem(item.id, { category_id: catId, confidence: "high" });
            }}
            onClose={onEditingClose}
            onCreateCategory={onCreateCategory}
          />
        )}
      </Table.Cell>

      {/* AI status / Confidence */}
      <Table.Cell>
        <span key={`ai-${item.id}-${item.aiStatus}`} className={css({ display: "inline-block" })}>
          <AiStatusCell item={item} />
        </span>
      </Table.Cell>

      {/* Duplicate warning icon */}
      <Table.Cell>
        {item.duplicate && <AlertTriangle size={14} className={css({ color: "expense" })} />}
      </Table.Cell>
    </tr>
  );
});

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
  onCreateCategory,
}: ReviewTableProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const getCategoryName = useCallback(
    (catId: string | null): string => {
      if (!catId) return "Uncategorized";
      for (const g of groups) {
        const cat = g.categories.find((c) => c.id === catId);
        if (cat) return cat.name;
      }
      return "Unknown";
    },
    [groups],
  );

  const handleClickRow = useCallback(
    (i: number) => {
      setActiveIdx(i);
      if (editingIdx !== null && editingIdx !== i) setEditingIdx(null);
    },
    [editingIdx],
  );

  const handleClickCategory = useCallback((i: number) => {
    setEditingIdx(i);
  }, []);

  const handleEditingClose = useCallback(() => {
    setEditingIdx(null);
  }, []);

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
        {isAiRunning && (
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "2",
              fontSize: "sm",
              color: "colorPalette.fg",
              whiteSpace: "nowrap",
              animation: "fade-in 200ms ease-out",
            })}
          >
            <Spinner size="xs" />
            <span>
              Categorizing… {aiRemaining}/{aiTotal} remaining
            </span>
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
              <span
                className={css({
                  display: "block",
                  h: "full",
                  rounded: "full",
                  bg: "colorPalette.9",
                  transition: "width 300ms ease-out",
                })}
                style={{ width: `${(aiDone / aiTotal) * 100}%` }}
              />
            </span>
          </span>
        )}

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
                    groups={groups}
                    getCategoryName={getCategoryName}
                    onClickRow={handleClickRow}
                    onClickCategory={handleClickCategory}
                    onUpdateItem={onUpdateItem}
                    onEditingClose={handleEditingClose}
                    onCreateCategory={onCreateCategory}
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
