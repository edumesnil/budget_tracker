import { css } from 'styled-system/css'

function App() {
  return (
    <div className={css({ p: '8', bg: 'bg', color: 'fg', minH: '100vh' })}>
      <h1 className={css({ fontSize: '3xl', fontWeight: 'bold' })}>
        Panda CSS works
      </h1>
    </div>
  )
}

export default App
