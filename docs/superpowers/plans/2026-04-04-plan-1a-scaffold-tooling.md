# Plan 1A: Project Scaffold & Tooling

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** Working Vite+ project with Panda CSS + Park UI design system configured.

**Architecture:** Clean scaffold on v2-rewrite branch. Panda CSS for styling with type-safe design tokens. Park UI components installed via CLI on Ark UI primitives.

**Tech Stack:** Vite+ (alpha), React 19, TypeScript, Panda CSS, Park UI, Ark UI

**Depends on:** Nothing (first plan)
**Enables:** Plan 1B, 1C, 1D

---

## Pre-flight

- Node >= 18 required (currently v18.20.8 via nvm)
- Current branch: `main`
- Uncommitted changes exist: modified `package.json`, `package-lock.json`, plus untracked files
- Files to preserve across clean slate: `.git/`, `docs/`, `Budget.xlsx`, `db_cluster-*.backup*`, `CLAUDE.md`, `.claude/`, `supabase/`

---

### Task 1: Git Setup — Stash, Branch, Clean Workspace

**Files:**
- Modify: workspace (removing v1 source files)

- [ ] **Step 1:** Stash all current uncommitted changes

```bash
cd /Users/ericdumesnil/Repo/budget_tracker
git stash push -u -m "v1-state-before-v2-rewrite"
```

- [ ] **Step 2:** Create `v2-rewrite` branch from `main`

```bash
git checkout -b v2-rewrite
```

- [ ] **Step 3:** Pop the stash to restore untracked files needed for v2

```bash
git stash pop
```

- [ ] **Step 4:** Remove all v1 source files, keeping only what we need

```bash
rm -rf app/ components/ contexts/ hooks/ lib/ utils/ styles/ public/ .next/ node_modules/
rm -f package.json package-lock.json pnpm-lock.yaml tsconfig.json tailwind.config.ts postcss.config.mjs next.config.mjs middleware.ts next-env.d.ts components.json icon-finder.tsx README.md
find . -name ".DS_Store" -delete
```

- [ ] **Step 5:** Verify only preserved files remain

```bash
ls -la
# Expected: .git/ .claude/ docs/ Budget.xlsx CLAUDE.md db_cluster-*.backup db_cluster-*.backup.gz
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: clean workspace for v2 rewrite

Remove all v1 source files, configs, and dependencies.
Preserve: docs/, Budget.xlsx, supabase backup, CLAUDE.md, .claude/"
```

---

### Task 2: Scaffold Vite+ React Project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`

- [ ] **Step 1:** Scaffold the project

```bash
cd /Users/ericdumesnil/Repo/budget_tracker
vp create vite:application --directory .v2-scaffold --no-interactive -- --template react-ts
```

If that fails, fallback:

```bash
npm create vite@latest .v2-scaffold -- --template react-ts
```

- [ ] **Step 2:** Move scaffolded files into project root

```bash
cp -r .v2-scaffold/* .v2-scaffold/.* . 2>/dev/null || true
rm -rf .v2-scaffold
```

- [ ] **Step 3:** Replace `.gitignore`

```gitignore
node_modules/
dist/
.vite/
styled-system/
.env
.env.*
!.env.example
.vscode/
.idea/
*.swp
.DS_Store
Thumbs.db
*.tsbuildinfo
npm-debug.log*
```

- [ ] **Step 4:** Update `package.json`

```json
{
  "name": "budget-tracker",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "prepare": "panda codegen"
  }
}
```

Keep `dependencies` and `devDependencies` from the scaffold as-is.

- [ ] **Step 5:** Install dependencies and verify

```bash
npm install
npm run dev -- --port 5173 &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite+ React TypeScript project"
```

---

### Task 3: Install and Configure Panda CSS

**Files:**
- Modify: `package.json`
- Create: `panda.config.ts`
- Create: `postcss.config.cjs`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`

- [ ] **Step 1:** Install Panda CSS

```bash
npm install -D @pandacss/dev postcss
npx panda init -p --jsx-framework react
```

- [ ] **Step 2:** Write `panda.config.ts` with design tokens

```typescript
import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  jsxFramework: 'react',
  preflight: true,
  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  exclude: [],

  conditions: {
    dark: '.dark &',
    light: '.light &',
  },

  theme: {
    extend: {
      tokens: {
        colors: {
          income: {
            DEFAULT: { value: 'hsl(174, 60%, 35%)' },
            light: { value: 'hsl(174, 60%, 45%)' },
            dark: { value: 'hsl(174, 60%, 40%)' },
            muted: { value: 'hsl(174, 60%, 35% / 0.1)' },
          },
          expense: {
            DEFAULT: { value: 'hsl(355, 70%, 55%)' },
            light: { value: 'hsl(355, 80%, 60%)' },
            dark: { value: 'hsl(355, 70%, 60%)' },
            muted: { value: 'hsl(355, 70%, 55% / 0.1)' },
          },
          chart: {
            1: { value: 'hsl(174, 60%, 35%)' },
            2: { value: 'hsl(355, 80%, 60%)' },
            3: { value: 'hsl(90, 70%, 75%)' },
            4: { value: 'hsl(90, 70%, 65%)' },
          },
        },
        fonts: {
          body: { value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
          mono: { value: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace' },
        },
      },
      semanticTokens: {
        colors: {
          bg: {
            DEFAULT: { value: { base: 'hsl(60, 10%, 98%)', _dark: 'hsl(196, 30%, 10%)' } },
            card: { value: { base: 'hsl(0, 0%, 100%)', _dark: 'hsl(196, 25%, 15%)' } },
            muted: { value: { base: 'hsl(196, 15%, 92%)', _dark: 'hsl(196, 20%, 20%)' } },
            sidebar: { value: { base: 'hsl(196, 30%, 15%)', _dark: 'hsl(196, 30%, 12%)' } },
          },
          fg: {
            DEFAULT: { value: { base: 'hsl(196, 30%, 15%)', _dark: 'hsl(90, 15%, 90%)' } },
            muted: { value: { base: 'hsl(196, 15%, 40%)', _dark: 'hsl(90, 15%, 70%)' } },
            sidebar: { value: { base: 'hsl(90, 30%, 90%)', _dark: 'hsl(90, 15%, 90%)' } },
          },
          border: {
            DEFAULT: { value: { base: 'hsl(174, 10%, 85%)', _dark: 'hsl(196, 20%, 25%)' } },
            ring: { value: { base: 'hsl(174, 60%, 35%)', _dark: 'hsl(174, 60%, 40%)' } },
          },
          income: { value: { base: 'hsl(174, 60%, 35%)', _dark: 'hsl(174, 60%, 40%)' } },
          expense: { value: { base: 'hsl(355, 80%, 60%)', _dark: 'hsl(355, 70%, 60%)' } },
          destructive: { value: { base: 'hsl(0, 84%, 60%)', _dark: 'hsl(0, 63%, 50%)' } },
        },
      },
    },
  },

  outdir: 'styled-system',
})
```

- [ ] **Step 3:** Verify `postcss.config.cjs` exists (created by `panda init`)

If missing, create:

```javascript
module.exports = {
  plugins: {
    '@pandacss/dev/postcss': {},
  },
}
```

- [ ] **Step 4:** Update `tsconfig.json` with path aliases

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"],
      "styled-system/*": ["./styled-system/*"]
    }
  },
  "include": ["src", "styled-system"]
}
```

- [ ] **Step 5:** Update `vite.config.ts` with aliases

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'styled-system': path.resolve(__dirname, './styled-system'),
    },
  },
})
```

- [ ] **Step 6:** Run codegen and verify

```bash
npx panda codegen
ls styled-system/
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: install and configure Panda CSS with design tokens

Ported v1 HSL color system into Panda CSS semantic tokens.
Dark mode via class-based .dark condition.
Financial colors: income (teal), expense (red)."
```

---

### Task 4: Install and Configure Park UI

**Files:**
- Modify: `package.json`
- Modify: `panda.config.ts` (add preset)
- Create: `src/components/ui/` (Park UI components)

- [ ] **Step 1:** Install Park UI and dependencies

```bash
npm install @park-ui/panda-preset @ark-ui/react lucide-react
npx @park-ui/cli init
```

When prompted: React, Panda CSS, `./src/components/ui`

- [ ] **Step 2:** Add Park UI preset to `panda.config.ts`

Add to the top of the config:

```typescript
import { createPreset } from '@park-ui/panda-preset'
```

Add `presets` array to the config:

```typescript
presets: [
  '@pandacss/preset-base',
  createPreset({
    accentColor: 'teal',
    grayColor: 'slate',
    borderRadius: 'md',
  }),
],
```

- [ ] **Step 3:** Install components

```bash
npx @park-ui/cli add button card dialog input label select tabs toast tooltip popover progress checkbox radio-group switch table
```

- [ ] **Step 4:** Regenerate codegen

```bash
npx panda codegen --clean
```

- [ ] **Step 5:** Verify components exist

```bash
ls src/components/ui/
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: install Park UI component library

15 components on Ark UI primitives. Park UI preset integrated."
```

---

### Task 5: Create globals.css and Dark Mode

**Files:**
- Create: `src/styles/globals.css`
- Create: `src/hooks/use-theme.ts`
- Modify: `src/main.tsx`
- Modify: `index.html`

- [ ] **Step 1:** Create `src/styles/globals.css`

```css
@layer reset, base, tokens, recipes, utilities;

body {
  margin: 0;
  min-height: 100vh;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 2:** Create `src/hooks/use-theme.ts`

```typescript
import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'budget-tracker-theme'

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'light'
  const s = localStorage.getItem(KEY)
  if (s === 'light' || s === 'dark') return s
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, set] = useState<Theme>(getInitial)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(KEY, t)
    set(t)
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggle }
}
```

- [ ] **Step 3:** Update `src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Remove `src/App.css` and `src/index.css` if they exist.

- [ ] **Step 4:** Add dark mode flash prevention to `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Budget Tracker</title>
    <script>
      (function () {
        var t = localStorage.getItem('budget-tracker-theme')
        if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        document.documentElement.classList.add(t)
      })()
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: globals.css and dark mode toggle

useTheme hook with localStorage persistence.
Flash prevention script in index.html."
```

---

### Task 6: Verification Page

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1:** Write verification App.tsx

```tsx
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
        Panda CSS + Park UI + Vite+ working.
      </p>
      <div className={css({ display: 'flex', gap: '4' })}>
        <Button variant="solid" onClick={toggle}>
          Toggle Theme ({theme})
        </Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
      <div className={css({ display: 'flex', gap: '4', mt: '4' })}>
        <span className={css({ color: 'income', fontWeight: 'semibold', fontSize: 'xl' })}>
          +$1,250.00
        </span>
        <span className={css({ color: 'expense', fontWeight: 'semibold', fontSize: 'xl' })}>
          -$890.50
        </span>
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 2:** Run dev server and verify manually

```bash
npm run dev
```

Checklist:
1. Page renders with heading
2. Park UI buttons render (solid, outline, ghost)
3. Income amount shows teal, expense shows red
4. Theme toggle switches light/dark
5. No console errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: verification page — Plan 1A complete

Confirms: Vite+ runs, Panda CSS tokens work, Park UI renders,
dark mode toggles correctly."
```

---

## Troubleshooting

- **Panda codegen fails:** Ensure `postcss.config.cjs` exists. Run `npx panda codegen --clean`.
- **Park UI CLI errors:** Run `npx @park-ui/cli init` interactively first, then `add` components.
- **Import path issues:** Verify both `tsconfig.json` paths and `vite.config.ts` aliases match.
- **Park UI preset conflicts:** Custom token names may overlap with preset. Rename if needed (e.g., `budgetTeal`).
- **`vp create` fails:** Vite+ is alpha. Fallback to `npm create vite@latest`.
