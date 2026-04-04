import { css } from '../../styled-system/css'

export default function CategoriesPage() {
  return (
    <div>
      <h1
        className={css({
          fontSize: '3xl',
          fontWeight: 'bold',
          color: 'fg',
        })}
      >
        Categories
      </h1>
      <p
        className={css({
          mt: '2',
          color: 'fg.muted',
        })}
      >
        Category and group management will go here.
      </p>
    </div>
  )
}
