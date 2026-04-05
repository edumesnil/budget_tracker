import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createListCollection } from "@ark-ui/react/collection";
import { Check, X, AlertTriangle, Sparkles, Database, HelpCircle } from "lucide-react";
import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";
import * as Table from "@/components/ui/table";
import * as Select from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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

  // Scroll active row into view
  useEffect(() => {
    const row = containerRef.current?.querySelector(`[data-row-idx="${activeIdx}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't intercept when select dropdown is open
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
                  <Table.Header>Date</Table.Header>
                  <Table.Header>Description</Table.Header>
                  <Table.Header className={css({ textAlign: "right" })}>Amount</Table.Header>
                  <Table.Header>Category</Table.Header>
                  <Table.Header>Confidence</Table.Header>
                  <Table.Header className={css({ w: "8" })} />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {items.map((item, idx) => {
                  const isActive = idx === activeIdx;
                  const isEditing = editingIdx === idx;

                  return (
                    <Table.Row
                      key={item.id}
                      data-row-idx={idx}
                      onClick={() => setActiveIdx(idx)}
                      className={css({
                        cursor: "pointer",
                        bg: isActive ? "colorPalette.2" : "transparent",
                        opacity: item.status === "skipped" ? 0.4 : 1,
                        transition: "background 100ms",
                      })}
                    >
                      {/* Status icon */}
                      <Table.Cell>
                        {item.status === "accepted" && (
                          <Check size={14} className={css({ color: "income" })} />
                        )}
                        {item.status === "skipped" && (
                          <X size={14} className={css({ color: "fg.muted" })} />
                        )}
                      </Table.Cell>

                      {/* Date */}
                      <Table.Cell className={css({ fontSize: "xs", whiteSpace: "nowrap" })}>
                        {formatDate(item.date)}
                      </Table.Cell>

                      {/* Description */}
                      <Table.Cell>
                        <div>
                          <span className={css({ fontSize: "sm", fontWeight: "500" })}>
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
                                Possible duplicate: {item.duplicate.description ?? "manual entry"}{" "}
                                on {formatDate(item.duplicate.date)}
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
                      <Table.Cell>
                        {isEditing ? (
                          <Select.Root
                            collection={categoryCollection}
                            value={item.category_id ? [item.category_id] : []}
                            onValueChange={(d: { value: string[] }) => {
                              const val = d.value[0];
                              if (val) {
                                onUpdateItem(item.id, { category_id: val, confidence: "high" });
                              }
                              setEditingIdx(null);
                            }}
                            onOpenChange={(d: { open: boolean }) => {
                              if (!d.open) setEditingIdx(null);
                            }}
                            open
                          >
                            <Select.Control>
                              <Select.Trigger className={css({ minW: "40" })}>
                                <Select.ValueText placeholder="Select category" />
                                <Select.Indicator />
                              </Select.Trigger>
                            </Select.Control>
                            <Select.Positioner>
                              <Select.Content className={css({ maxH: "48", overflowY: "auto" })}>
                                {groups
                                  .filter((g) => g.id !== "__ungrouped__")
                                  .map((g) => (
                                    <Select.ItemGroup key={g.id}>
                                      <Select.ItemGroupLabel>{g.name}</Select.ItemGroupLabel>
                                      {g.categories.map((cat) => (
                                        <Select.Item
                                          key={cat.id}
                                          item={{ label: cat.name, value: cat.id }}
                                        >
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
                          <span
                            className={css({
                              fontSize: "sm",
                              color: item.category_id ? "fg.default" : "fg.muted",
                              fontStyle: item.category_id ? "normal" : "italic",
                            })}
                          >
                            {getCategoryName(item.category_id)}
                          </span>
                        )}
                      </Table.Cell>

                      {/* Confidence */}
                      <Table.Cell>
                        <ConfidenceBadge confidence={item.confidence} />
                      </Table.Cell>

                      {/* Duplicate warning icon */}
                      <Table.Cell>
                        {item.duplicate && (
                          <AlertTriangle size={14} className={css({ color: "expense" })} />
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </div>
        </Card.Body>
      </Card.Root>
    </div>
  );
}
