import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { Button } from '@/components/ui/button'
import type { CategoryGroup, Category } from '@/types/database'
import type { GroupWithCategories } from '@/hooks/use-categories'

interface CategoryListProps {
  group: GroupWithCategories
  onEditGroup: (group: CategoryGroup) => void
  onDeleteGroup: (groupId: string) => void
  onAddCategory: (groupId: string | null) => void
  onEditCategory: (category: Category) => void
  onDeleteCategory: (categoryId: string) => void
}

function TypeBadge({ type }: { type: 'INCOME' | 'EXPENSE' }) {
  const isIncome = type === 'INCOME'
  return (
    <span
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        px: '1.5',
        py: '0.5',
        rounded: 'sm',
        fontSize: 'xs',
        fontWeight: '500',
        letterSpacing: 'wide',
        fontFamily: 'mono',
        bg: isIncome ? 'teal.light.3' : 'red.light.3',
        color: isIncome ? 'teal.light.11' : 'red.light.11',
        _dark: {
          bg: isIncome ? 'teal.dark.3' : 'red.dark.3',
          color: isIncome ? 'teal.dark.11' : 'red.dark.11',
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
        borderBottom: '1px solid',
        borderColor: 'border.subtle',
        _last: { borderBottom: 'none' },
        _hover: { bg: 'bg.subtle' },
        transition: 'background 120ms ease',
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
              w: '7',
              h: '7',
              rounded: 'md',
              fontSize: 'sm',
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
            fontSize: 'sm',
            fontWeight: '500',
            color: 'fg.default',
          })}
        >
          {category.name}
        </span>
      </div>

      {/* Center: type badge */}
      <div className={css({ mx: '4' })}>
        <TypeBadge type={category.type} />
      </div>

      {/* Right: actions */}
      <div className={css({ display: 'flex', gap: '1' })}>
        <Button variant="plain" size="xs" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="plain"
          size="xs"
          onClick={onDelete}
          className={css({
            color: 'red.default',
            _hover: { bg: 'red.light.3', color: 'red.light.11' },
            _dark: { _hover: { bg: 'red.dark.3', color: 'red.dark.11' } },
          })}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}

export function CategoryList({
  group,
  onEditGroup,
  onDeleteGroup,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoryListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isVirtual = group.id === '__ungrouped__'

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
          py: '2.5',
          bg: 'bg.subtle',
          borderBottom: isCollapsed ? 'none' : '1px solid',
          borderColor: 'border.subtle',
          cursor: 'pointer',
          userSelect: 'none',
        })}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {/* Left: indicator + name + count */}
        <div className={css({ display: 'flex', alignItems: 'center', gap: '2.5' })}>
          <span
            className={css({
              fontSize: 'xs',
              color: 'fg.subtle',
              display: 'inline-block',
              transition: 'transform 200ms ease',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              lineHeight: '1',
            })}
          >
            ▾
          </span>

          {group.icon && (
            <span style={{ color: group.color ?? undefined }}>
              {group.icon}
            </span>
          )}

          <span
            className={css({
              fontSize: 'sm',
              fontWeight: '600',
              color: 'fg.default',
            })}
          >
            {group.name}
          </span>

          <span
            className={css({
              fontSize: 'xs',
              color: 'fg.subtle',
              bg: 'bg.muted',
              px: '1.5',
              py: '0.5',
              rounded: 'full',
              fontFamily: 'mono',
            })}
          >
            {group.categories.length}
          </span>
        </div>

        {/* Right: group actions */}
        <div
          className={css({ display: 'flex', gap: '1' })}
          onClick={(e) => e.stopPropagation()}
        >
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
                  color: 'red.default',
                  _hover: { bg: 'red.light.3', color: 'red.light.11' },
                  _dark: { _hover: { bg: 'red.dark.3', color: 'red.dark.11' } },
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
                  color: 'teal.default',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  padding: '0',
                  _hover: { color: 'teal.emphasized' },
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
    </div>
  )
}
