import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { Button } from '@/components/ui/button'
import type { CategoryGroup, Category } from '@/types/database'
import type { GroupWithCategories } from '@/hooks/use-categories'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryListProps {
  group: GroupWithCategories
  onEditGroup: (group: CategoryGroup) => void
  onDeleteGroup: (groupId: string) => void
  onAddCategory: (groupId: string | null) => void
  onEditCategory: (category: Category) => void
  onDeleteCategory: (categoryId: string) => void
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: 'INCOME' | 'EXPENSE' }) {
  const isIncome = type === 'INCOME'
  return (
    <span
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        px: '2',
        py: '0.5',
        rounded: 'full',
        fontSize: 'xs',
        fontWeight: 'medium',
        bg: isIncome ? 'green.100' : 'red.100',
        color: isIncome ? 'green.800' : 'red.800',
        _dark: {
          bg: isIncome ? 'green.900/30' : 'red.900/30',
          color: isIncome ? 'green.300' : 'red.300',
        },
      })}
    >
      {type}
    </span>
  )
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: '2.5',
        px: '4',
        borderBottomWidth: '1px',
        borderColor: 'border.muted',
        _last: { borderBottomWidth: '0' },
        _hover: { bg: 'bg.muted' },
        transition: 'colors',
        transitionDuration: '150ms',
      })}
    >
      {/* Left: icon + name */}
      <div className={css({ display: 'flex', alignItems: 'center', gap: '3', flex: '1' })}>
        {category.icon && (
          <span
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              w: '8',
              h: '8',
              rounded: 'md',
              fontSize: 'sm',
            })}
            style={{
              backgroundColor: category.color
                ? `${category.color}15`
                : undefined,
              color: category.color ?? undefined,
            }}
          >
            {category.icon}
          </span>
        )}
        <span className={css({ fontWeight: 'medium' })}>{category.name}</span>
      </div>

      {/* Center: type badge */}
      <div className={css({ mx: '4' })}>
        <TypeBadge type={category.type} />
      </div>

      {/* Right: actions */}
      <div className={css({ display: 'flex', gap: '1' })}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className={css({
            color: 'red.500',
            _hover: { color: 'red.700', bg: 'red.50' },
            _dark: { _hover: { bg: 'red.900/20' } },
          })}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CategoryList({
  group,
  onEditGroup,
  onDeleteGroup,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoryListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isVirtualUngrouped = group.id === '__ungrouped__'

  return (
    <div
      className={css({
        borderWidth: '1px',
        borderColor: 'border.default',
        rounded: 'lg',
        overflow: 'hidden',
        bg: 'bg.default',
      })}
    >
      {/* Group header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: '4',
          py: '3',
          bg: 'bg.subtle',
          borderBottomWidth: isCollapsed ? '0' : '1px',
          borderColor: 'border.default',
          cursor: 'pointer',
          userSelect: 'none',
        })}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {/* Left: collapse indicator + name + count */}
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
          <span
            className={css({
              fontSize: 'sm',
              color: 'fg.muted',
              transition: 'transform',
              transitionDuration: '200ms',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            })}
          >
            &#x25BC;
          </span>

          {group.icon && (
            <span
              className={css({ fontSize: 'lg' })}
              style={{ color: group.color ?? undefined }}
            >
              {group.icon}
            </span>
          )}

          <span className={css({ fontWeight: 'semibold', fontSize: 'md' })}>
            {group.name}
          </span>

          <span
            className={css({
              fontSize: 'sm',
              color: 'fg.muted',
              bg: 'bg.muted',
              px: '2',
              py: '0.5',
              rounded: 'full',
            })}
          >
            {group.categories.length} {group.categories.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        {/* Right: group actions */}
        <div
          className={css({ display: 'flex', gap: '1' })}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddCategory(group.id)}
          >
            + Add
          </Button>

          {!isVirtualUngrouped && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditGroup(group)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteGroup(group.id)}
                className={css({
                  color: 'red.500',
                  _hover: { color: 'red.700', bg: 'red.50' },
                  _dark: { _hover: { bg: 'red.900/20' } },
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
                py: '6',
                textAlign: 'center',
                color: 'fg.muted',
                fontSize: 'sm',
              })}
            >
              No categories in this group.{' '}
              <button
                type="button"
                onClick={() => onAddCategory(group.id)}
                className={css({
                  color: 'accent.default',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  _hover: { color: 'accent.emphasized' },
                })}
              >
                Add one
              </button>
            </div>
          ) : (
            group.categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={() => onEditCategory(category)}
                onDelete={() => onDeleteCategory(category.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
