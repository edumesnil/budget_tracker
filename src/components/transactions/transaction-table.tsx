import { css } from '../../../styled-system/css'
import * as Table from '@/components/ui/table'
import * as Card from '@/components/ui/card'
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
          px: '1.5',
          py: '0.5',
          rounded: 'sm',
          fontSize: 'xs',
          fontWeight: '500',
          letterSpacing: 'wide',
          color: isIncome ? 'income' : 'expense',
          bg: isIncome ? 'income.muted' : 'expense.muted',
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
      <Card.Root>
        <Card.Body className={css({ textAlign: 'center', py: '16', color: 'fg.muted' })}>
          <p className={css({ fontWeight: '500', mb: '1' })}>No transactions this month</p>
          <p className={css({ fontSize: 'sm' })}>Add a transaction to get started.</p>
        </Card.Body>
      </Card.Root>
    )
  }

  return (
    <Card.Root>
      <Table.Root interactive>
        <Table.Head>
          <Table.Row>
            <Table.Header>Date</Table.Header>
            <Table.Header>Description</Table.Header>
            <Table.Header>Category</Table.Header>
            <Table.Header className={css({ textAlign: 'right' })}>Amount</Table.Header>
            <Table.Header />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {transactions.map((tx) => (
            <Table.Row key={tx.id}>
              <Table.Cell>
                {formatDate(tx.date)}
              </Table.Cell>

              <Table.Cell className={css({ maxW: '56' })}>
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

              <Table.Cell>
                <CategoryCell transaction={tx} />
              </Table.Cell>

              <Table.Cell className={css({ textAlign: 'right' })}>
                <AmountCell transaction={tx} />
              </Table.Cell>

              <Table.Cell>
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
                      color: 'fg.muted',
                      _hover: { bg: 'bg.muted', color: 'fg.default' },
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
    </Card.Root>
  )
}
