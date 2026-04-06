import { useState } from "react";
import { css } from "../../../styled-system/css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as Card from "@/components/ui/card";
import type { CategoryGroup, Category } from "@/types/database";
import type { GroupWithCategories } from "@/hooks/use-categories";

interface CategoryListProps {
  group: GroupWithCategories;
  onEditGroup: (group: CategoryGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddCategory: (groupId: string | null) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
}

function TypeBadge({ type }: { type: "INCOME" | "EXPENSE" }) {
  const isIncome = type === "INCOME";
  return (
    <Badge
      size="sm"
      variant="subtle"
      className={css({
        color: isIncome ? "income" : "expense",
        bg: isIncome ? "income.muted" : "expense.muted",
        borderColor: "transparent",
      })}
    >
      {type}
    </Badge>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: "2.5",
        px: "4",
        _hover: { bg: "bg.subtle" },
        transition: "background 120ms ease",
      })}
    >
      {/* Left: icon + name */}
      <div className={css({ display: "flex", alignItems: "center", gap: "3", flex: "1" })}>
        {category.icon && (
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              w: "7",
              h: "7",
              rounded: "md",
              fontSize: "sm",
              flexShrink: 0,
            })}
            style={{
              backgroundColor: category.color ? `${category.color}20` : undefined,
              color: category.color ?? undefined,
            }}
          >
            {category.icon}
          </span>
        )}
        <span
          className={css({
            fontSize: "sm",
            fontWeight: "500",
            color: "fg.default",
          })}
        >
          {category.name}
        </span>
      </div>

      {/* Center: type badge */}
      <div className={css({ mx: "4" })}>
        <TypeBadge type={category.type} />
      </div>

      {/* Right: actions */}
      <div className={css({ display: "flex", gap: "1" })}>
        <Button variant="plain" size="xs" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="plain"
          size="xs"
          onClick={onDelete}
          className={css({
            color: "fg.muted",
            _hover: { bg: "bg.muted", color: "fg.default" },
          })}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export function CategoryList({
  group,
  onEditGroup,
  onDeleteGroup,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoryListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isVirtual = group.id === "__ungrouped__";

  return (
    <Card.Root>
      {/* Group header */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: "4",
          py: "2.5",
          bg: "bg.subtle",
          cursor: "pointer",
          userSelect: "none",
        })}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {/* Left: indicator + name + count */}
        <div className={css({ display: "flex", alignItems: "center", gap: "2.5" })}>
          <span
            className={css({
              fontSize: "xs",
              color: "fg.subtle",
              display: "inline-block",
              transition: "transform 200ms ease",
              transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
              lineHeight: "1",
            })}
          >
            ▾
          </span>

          {group.icon && <span style={{ color: group.color ?? undefined }}>{group.icon}</span>}

          <span
            className={css({
              fontSize: "sm",
              fontWeight: "600",
              color: "fg.default",
            })}
          >
            {group.name}
          </span>

          <span
            className={css({
              fontSize: "xs",
              color: "fg.subtle",
              bg: "bg.muted",
              px: "1.5",
              py: "0.5",
              rounded: "full",
            })}
          >
            {group.categories.length}
          </span>
        </div>

        {/* Right: group actions */}
        <div className={css({ display: "flex", gap: "1" })} onClick={(e) => e.stopPropagation()}>
          <Button variant="plain" size="xs" onClick={() => onAddCategory(group.id)}>
            + Add
          </Button>

          {!isVirtual && (
            <>
              <Button variant="plain" size="xs" onClick={() => onEditGroup(group)}>
                Edit
              </Button>
              <Button
                variant="plain"
                size="xs"
                onClick={() => onDeleteGroup(group.id)}
                className={css({
                  color: "fg.muted",
                  _hover: { bg: "bg.muted", color: "fg.default" },
                })}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Category rows */}
      {!isCollapsed && (
        <div>
          {group.categories.length === 0 ? (
            <div
              className={css({
                py: "6",
                textAlign: "center",
                color: "fg.muted",
                fontSize: "sm",
              })}
            >
              No categories in this group.{" "}
              <button
                type="button"
                onClick={() => onAddCategory(group.id)}
                className={css({
                  color: "colorPalette.11",
                  textDecoration: "underline",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  padding: "0",
                  _hover: { color: "colorPalette.9" },
                })}
              >
                Add one
              </button>
            </div>
          ) : (
            group.categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                onEdit={() => onEditCategory(cat)}
                onDelete={() => onDeleteCategory(cat.id)}
              />
            ))
          )}
        </div>
      )}
    </Card.Root>
  );
}
