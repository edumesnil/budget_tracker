import { css } from 'styled-system/css'
import { Button } from './components/ui/button'
import { useTheme } from './hooks/use-theme'

function App() {
  const { theme, toggle } = useTheme()

  return (
    <div className={css({
      minH: '100vh', display: 'flex', flexDir: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '6', p: '8',
    })}>
      <h1 className={css({ fontSize: '3xl', fontWeight: 'bold' })}>
        Budget Tracker v2
      </h1>
      <p className={css({ color: 'fg.muted', fontSize: 'lg' })}>
        Panda CSS + Park UI + Vite scaffold working.
      </p>
      <div className={css({ display: 'flex', gap: '4' })}>
        <Button variant="solid" onClick={toggle}>
          Toggle Theme ({theme})
        </Button>
        <Button variant="outline">Outline</Button>
        <Button variant="plain">Plain</Button>
      </div>
      <div className={css({ display: 'flex', gap: '4', mt: '4' })}>
        <span className={css({ color: 'income', fontWeight: 'semibold', fontSize: 'xl' })}>
          +$1,250.00
        </span>
        <span className={css({ color: 'expense', fontWeight: 'semibold', fontSize: 'xl' })}>
          -$890.50
        </span>
      </div>
      <p className={css({ color: 'fg.muted', fontSize: 'xs', mt: '8' })}>
        Plan 1A complete. Ready for Plan 1B.
      </p>
    </div>
  )
}

export default App
