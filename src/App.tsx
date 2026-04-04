import { css } from 'styled-system/css'
import { Button } from './components/ui/button'

function App() {
  return (
    <div className={css({ p: '8', bg: 'bg', color: 'fg', minH: '100vh', display: 'flex', flexDir: 'column', gap: '4', alignItems: 'center', justifyContent: 'center' })}>
      <h1 className={css({ fontSize: '3xl', fontWeight: 'bold' })}>Park UI works</h1>
      <div className={css({ display: 'flex', gap: '4' })}>
        <Button variant="solid">Solid</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="plain">Plain</Button>
      </div>
    </div>
  )
}

export default App
