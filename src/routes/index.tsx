import { css } from '../../styled-system/css'

export default function IndexPage() {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bg: 'bg',
        color: 'fg',
      })}
    >
      <h1
        className={css({
          fontSize: '3xl',
          fontWeight: 'bold',
        })}
      >
        Welcome
      </h1>
    </div>
  )
}
