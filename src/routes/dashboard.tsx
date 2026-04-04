import { css } from '../../styled-system/css'

export default function DashboardPage() {
  return (
    <div>
      <h1
        className={css({
          fontSize: '3xl',
          fontWeight: 'bold',
          color: 'fg',
        })}
      >
        Dashboard
      </h1>
      <p
        className={css({
          mt: '2',
          color: 'fg.muted',
        })}
      >
        Financial overview will go here.
      </p>
    </div>
  )
}
