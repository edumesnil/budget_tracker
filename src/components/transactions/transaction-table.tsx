import { css } from '../../../styled-system/css'
import * as Table from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types/database'

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete: (id: string) => void
}

function AmountCell({ transaction }: { transaction: Transaction }) {
  const type = transaction.categories?.type
  const isIncome = type === 'INCOME'
  const isExpense = type === 'EXPENSE'

  return (
    <span
      className={css({
        fontFamily: 'mono',
        fontSize: 'sm',
        fontWeight: '500',
        color: isIncome ? 'income' : isExpense ? 'expense' : 'fg.default',
      })}
    >
      {isIncome ? '+' : isExpense ? '−' : ''}{formatCurrency(transaction.amount)}
    </span>
  )
}

function CategoryCell({ transaction }: { transaction: Transaction }) {
  const cat = transaction.categories
  if (!cat) {
    return (
      <span className={css({ color: 'fg.subtle', fontSize: 'sm', fontStyle: 'italic' })}>
        Uncategorized
      </span>
    )
  }

  const isIncome = cat.type === 'INCOME'

  return (
    <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
      {cat.icon && <span className={css({ fontSize: 'sm' })}>{cat.icon}</span>}
      <span className={css({ fontSize: 'sm', color: 'fg.default' })}>{cat.name}</span>
      <span
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          px: '1',
          py: '0.5',
          rounded: 'xs',
          fontSize: 'xs',
          fontFamily: 'mono',
          letterSpacing: 'wide',
          bg: isIncome ? 'teal.light.3' : 'red.light.3',
          color: isIncome ? 'teal.light.11' : 'red.light.11',
          _dark: {
            bg: isIncome ? 'teal.dark.3' : 'red.dark.3',
            color: isIncome ? 'teal.dark.11' : 'red.dark.11',
          },
        })}
      >
        {cat.type}
      </span>
    </div>
  )
}

export function TransactionTable({
  transactions,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div
        className={css({
          textAlign: 'center',
          py: '16',
          color: 'fg.muted',
          borderWidth: '1px',
          borderColor: 'border.default',
          rounded: 'lg',
          bg: 'bg.default',
        })}
      >
        <p className={css({ fontWeight: '500', mb: '1' })}>No transactions this month</p>
        <p className={css({ fontSize: 'sm' })}>Add a transaction to get started.</p>
      </div>
    )
  }

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
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.Header
              className={css({
                fontSize: 'xs',
                fontWeight: '600',
                color: 'fg.muted',
                letterSpacing: 'wide',
                textTransform: 'uppercase',
                py: '2.5',
                px: '4',
              })}
            >
              Date
            </Table.Header>
            <Table.Header
              className={css({
                fontSize: 'xs',
                fontWeight: '600',
                color: 'fg.muted',
                letterSpacing: 'wide',
                textTransform: 'uppercase',
                py: '2.5',
                px: '4',
              })}
            >
              Description
            </Table.Header>
            <Table.Header
              className={css({
                fontSize: 'xs',
                fontWeight: '600',
                color: 'fg.muted',
                letterSpacing: 'wide',
                textTransform: 'uppercase',
                py: '2.5',
                px: '4',
              })}
            >
              Category
            </Table.Header>
            <Table.Header
              className={css({
                fontSize: 'xs',
                fontWeight: '600',
                color: 'fg.muted',
                letterSpacing: 'wide',
                textTransform: 'uppercase',
                py: '2.5',
                px: '4',
                textAlign: 'right',
              })}
            >
              Amount
            </Table.Header>
            <Table.Header
              className={css({
                py: '2.5',
                px: '4',
                w: '24',
              })}
            />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {transactions.map((tx) => (
            <Table.Row
              key={tx.id}
              className={css({
                borderTop: '1px solid',
                borderColor: 'border.subtle',
                _hover: { bg: 'bg.subtle' },
                transition: 'background 120ms ease',
              })}
            >
              <Table.Cell
                className={css({
                  py: '3',
                  px: '4',
                  fontSize: 'sm',
                  color: 'fg.muted',
                  fontFamily: 'mono',
                  whiteSpace: 'nowrap',
                })}
              >
                {formatDate(tx.date)}
              </Table.Cell>

              <Table.Cell
                className={css({
                  py: '3',
                  px: '4',
                  maxW: '56',
                })}
              >
                <div>
                  <p
                    className={css({
                      fontSize: 'sm',
                      color: 'fg.default',
                      fontWeight: tx.description ? '500' : '400',
                      fontStyle: tx.description ? 'normal' : 'italic',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    {tx.description || 'No description'}
                  </p>
                  {tx.notes && (
                    <p
                      className={css({
                        fontSize: 'xs',
                        color: 'fg.subtle',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mt: '0.5',
                      })}
                    >
                      {tx.notes}
                    </p>
                  )}
                </div>
              </Table.Cell>

              <Table.Cell className={css({ py: '3', px: '4' })}>
                <CategoryCell transaction={tx} />
              </Table.Cell>

              <Table.Cell
                className={css({
                  py: '3',
                  px: '4',
                  textAlign: 'right',
                })}
              >
                <AmountCell transaction={tx} />
              </Table.Cell>

              <Table.Cell
                className={css({
                  py: '3',
                  px: '4',
                })}
              >
                <div className={css({ display: 'flex', gap: '1', justifyContent: 'flex-end' })}>
                  <Button
                    variant="plain"
                    size="xs"
                    onClick={() => onEdit(tx)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="plain"
                    size="xs"
                    onClick={() => onDelete(tx.id)}
                    className={css({
                      color: 'red.default',
                      _hover: {
                        bg: 'red.light.3',
                        color: 'red.light.11',
                      },
                      _dark: {
                        _hover: {
                          bg: 'red.dark.3',
                          color: 'red.dark.11',
                        },
                      },
                    })}
                  >
                    Delete
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  )
}
