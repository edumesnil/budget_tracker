import { css } from '../../styled-system/css'

export default function BudgetsPage() {
  return (
    <div>
      <h1
        className={css({
          fontSize: '3xl',
          fontWeight: 'bold',
          color: 'fg',
        })}
      >
        Budgets
      </h1>
      <p
        className={css({
          mt: '2',
          color: 'fg.muted',
        })}
      >
        Budget management will go here.
      </p>
    </div>
  )
}
