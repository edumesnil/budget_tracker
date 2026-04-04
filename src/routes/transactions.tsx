import { css } from '../../styled-system/css'

export default function TransactionsPage() {
  return (
    <div>
      <h1
        className={css({
          fontSize: '3xl',
          fontWeight: 'bold',
          color: 'fg.default',
        })}
      >
        Transactions
      </h1>
      <p
        className={css({
          mt: '2',
          color: 'fg.muted',
        })}
      >
        Transaction list and management will go here.
      </p>
    </div>
  )
}
