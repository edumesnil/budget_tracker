# Plan 1C: Auth & Routing

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** Working auth flow with login/register, React Router navigation, dashboard layout shell with sidebar/topbar, and dev auto-login.

**Architecture:** React Router v7 for SPA routing. Supabase email/password auth via use-auth hook. Layout shell wraps all dashboard routes with auth guard. Dark mode via class toggle + localStorage.

**Tech Stack:** React Router v7, Supabase Auth, TanStack React Query v5, Panda CSS, Park UI

**Depends on:** Plan 1A (scaffold + styling), Plan 1B (Supabase + types)
**Enables:** Plan 1D (categories CRUD)

---

## Step 1: Install dependencies

```bash
npm install react-router @tanstack/react-query @tanstack/react-query-devtools
```

**Verify:** `package.json` includes `react-router`, `@tanstack/react-query`, `@tanstack/react-query-devtools` in dependencies.

---

## Step 2: Create `src/lib/query-client.ts`

React Query client singleton with per-entity staleTime defaults from the design spec.

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s default
      gcTime: 300_000,   // 5 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    },
  },
})
```

---

## Step 3: Create `src/hooks/use-auth.ts`

Auth hook managing Supabase session state. Exposes user, session, loading state, and auth actions. Includes dev auto-login.

```typescript
// src/hooks/use-auth.ts
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()

        if (mounted) {
          setSession(currentSession)
          setUser(currentSession?.user ?? null)
          setIsLoading(false)
        }

        // Dev auto-login: if no session and auto-login enabled, sign in with seed user
        if (
          !currentSession &&
          import.meta.env.VITE_DEV_AUTOLOGIN === 'true' &&
          import.meta.env.DEV
        ) {
          const { data } = await supabase.auth.signInWithPassword({
            email: 'dev@budgettracker.local',
            password: 'devpassword123',
          })
          if (mounted && data.session) {
            setSession(data.session)
            setUser(data.session.user)
            setIsLoading(false)
          }
        }
      } catch (error) {
        console.error('Auth init error:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          setSession(newSession)
          setUser(newSession?.user ?? null)
          setIsLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })

    // If signup successful, also insert into public.users table
    if (!error) {
      const { data: { user: newUser } } = await supabase.auth.getUser()
      if (newUser) {
        await supabase.from('users').insert({
          id: newUser.id,
          email: newUser.email!,
        })
      }
    }

    return { error: error ? new Error(error.message) : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

---

## Step 4: Create `src/hooks/use-theme.ts`

Dark mode toggle hook. Persists preference to localStorage. Toggles `dark` class on `<html>` element (Panda CSS uses `_dark` condition which checks for this class).

```typescript
// src/hooks/use-theme.ts
import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'budget-tracker-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored

  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // Apply theme class to <html> on mount and change
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't set a preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        setThemeState(e.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
  }, [])

  const isDark = theme === 'dark'

  return { theme, isDark, toggleTheme, setTheme }
}
```

---

## Step 5: Create `src/app.tsx`

React Router setup with all providers. Defines flat route structure with a layout wrapper for dashboard routes.

```typescript
// src/app.tsx
import { BrowserRouter, Routes, Route } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/hooks/use-auth'
import { DashboardLayout } from '@/routes/_layout'
import IndexPage from '@/routes/index'
import LoginPage from '@/routes/login'
import RegisterPage from '@/routes/register'
import DashboardPage from '@/routes/dashboard'
import TransactionsPage from '@/routes/transactions'
import BudgetsPage from '@/routes/budgets'
import CategoriesPage from '@/routes/categories'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route index element={<IndexPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />

            {/* Dashboard routes — wrapped in layout with auth guard */}
            <Route element={<DashboardLayout />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

---

## Step 6: Create `src/main.tsx`

Entry point. Renders App into the root div.

```typescript
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app'
import './styles/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

---

## Step 7: Update `index.html`

Update the existing `index.html` at project root to work with Vite + React.

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Budget Tracker</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Step 8: Create `src/routes/_layout.tsx`

Dashboard shell with sidebar navigation and topbar. Auth guard redirects to `/login` if not authenticated. Uses Panda CSS for all styling.

```typescript
// src/routes/_layout.tsx
import { Outlet, Navigate, NavLink, useLocation } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { css } from '../../styled-system/css'
import { Home, CreditCard, DollarSign, Tag, LogOut, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/transactions', label: 'Transactions', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: DollarSign },
  { to: '/categories', label: 'Categories', icon: Tag },
] as const

export function DashboardLayout() {
  const { user, isLoading, signOut } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bg: 'bg',
        })}
      >
        <div
          className={css({
            width: '8',
            height: '8',
            border: '4px solid token(colors.border)',
            borderTopColor: 'accent.default',
            borderRadius: 'full',
            animation: 'spin 1s linear infinite',
          })}
        />
      </div>
    )
  }

  // Auth guard: redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div
      className={css({
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
      })}
    >
      {/* Sidebar */}
      <aside
        className={css({
          display: 'flex',
          flexDirection: 'column',
          width: '64',
          minWidth: '64',
          height: '100vh',
          bg: { base: 'gray.900', _dark: 'gray.950' },
          color: 'white',
          borderRight: '1px solid',
          borderColor: { base: 'gray.800', _dark: 'gray.800' },
          flexShrink: 0,
        })}
      >
        {/* Logo */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '3',
            px: '6',
            py: '5',
            borderBottom: '1px solid',
            borderColor: 'gray.800',
          })}
        >
          <DollarSign
            size={24}
            className={css({ color: 'green.400' })}
          />
          <span
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              letterSpacing: 'tight',
            })}
          >
            Budget Tracker
          </span>
        </div>

        {/* Navigation */}
        <nav
          className={css({
            flex: 1,
            py: '4',
            px: '3',
            display: 'flex',
            flexDirection: 'column',
            gap: '1',
          })}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  px: '3',
                  py: '2.5',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  transition: 'colors',
                  transitionDuration: '150ms',
                  color: isActive ? 'white' : 'gray.400',
                  bg: isActive ? 'gray.800' : 'transparent',
                  _hover: {
                    bg: 'gray.800',
                    color: 'white',
                  },
                })
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section at bottom */}
        <div
          className={css({
            borderTop: '1px solid',
            borderColor: 'gray.800',
            p: '4',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '3',
              mb: '3',
            })}
          >
            <div
              className={css({
                width: '8',
                height: '8',
                borderRadius: 'full',
                bg: 'gray.700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'sm',
                fontWeight: 'bold',
              })}
            >
              {user.email?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div
              className={css({
                flex: 1,
                minWidth: 0,
              })}
            >
              <p
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  truncate: true,
                })}
              >
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              width: 'full',
              px: '3',
              py: '2',
              borderRadius: 'md',
              fontSize: 'sm',
              color: 'gray.400',
              cursor: 'pointer',
              bg: 'transparent',
              border: 'none',
              _hover: {
                bg: 'gray.800',
                color: 'white',
              },
              transition: 'colors',
              transitionDuration: '150ms',
            })}
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        })}
      >
        {/* Topbar */}
        <header
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            height: '14',
            px: '6',
            borderBottom: '1px solid',
            borderColor: 'border',
            bg: 'bg',
            flexShrink: 0,
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            })}
          >
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '9',
                height: '9',
                borderRadius: 'md',
                border: 'none',
                bg: 'transparent',
                color: 'fg.muted',
                cursor: 'pointer',
                _hover: {
                  bg: { base: 'gray.100', _dark: 'gray.800' },
                  color: 'fg',
                },
                transition: 'colors',
                transitionDuration: '150ms',
              })}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main
          className={css({
            flex: 1,
            overflow: 'auto',
            bg: 'bg',
            color: 'fg',
          })}
        >
          <div
            className={css({
              p: { base: '4', md: '8' },
              maxWidth: '7xl',
              mx: 'auto',
            })}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
```

---

## Step 9: Create `src/routes/login.tsx`

Email/password login form using Park UI components. Redirects to `/dashboard` on success.

```typescript
// src/routes/login.tsx
import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { css } from '../../styled-system/css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        setError(signInError.message)
        return
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign in')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bg: 'bg',
        px: '4',
      })}
    >
      <Card.Root
        className={css({
          width: 'full',
          maxWidth: 'md',
        })}
      >
        <Card.Header>
          <Card.Title
            className={css({ fontSize: '2xl' })}
          >
            Login
          </Card.Title>
          <Card.Description>
            Enter your credentials to access your account
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <form
            onSubmit={handleSubmit}
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '4',
            })}
          >
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5',
              })}
            >
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5',
              })}
            >
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'red.500',
                })}
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              width="full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card.Body>
        <Card.Footer
          className={css({
            justifyContent: 'center',
          })}
        >
          <p
            className={css({
              fontSize: 'sm',
              color: 'fg.muted',
            })}
          >
            Don't have an account?{' '}
            <Link
              to="/register"
              className={css({
                color: 'accent.default',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Register
            </Link>
          </p>
        </Card.Footer>
      </Card.Root>
    </div>
  )
}
```

---

## Step 10: Create `src/routes/register.tsx`

Email/password registration form. Redirects to `/login` on success with a success message.

```typescript
// src/routes/register.tsx
import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { css } from '../../styled-system/css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signUp, user } = useAuth()
  const navigate = useNavigate()

  // If already logged in, redirect to dashboard
  if (user) {
    navigate('/dashboard')
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsSubmitting(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsSubmitting(false)
      return
    }

    try {
      const { error: signUpError } = await signUp(email, password)
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      // Registration successful — redirect to login
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bg: 'bg',
        px: '4',
      })}
    >
      <Card.Root
        className={css({
          width: 'full',
          maxWidth: 'md',
        })}
      >
        <Card.Header>
          <Card.Title
            className={css({ fontSize: '2xl' })}
          >
            Create an account
          </Card.Title>
          <Card.Description>
            Enter your email and create a password to get started
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <form
            onSubmit={handleSubmit}
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '4',
            })}
          >
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5',
              })}
            >
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5',
              })}
            >
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5',
              })}
            >
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'red.500',
                })}
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              width="full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Register'}
            </Button>
          </form>
        </Card.Body>
        <Card.Footer
          className={css({
            justifyContent: 'center',
          })}
        >
          <p
            className={css({
              fontSize: 'sm',
              color: 'fg.muted',
            })}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              className={css({
                color: 'accent.default',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Login
            </Link>
          </p>
        </Card.Footer>
      </Card.Root>
    </div>
  )
}
```

---

## Step 11: Create `src/routes/index.tsx`

Landing page — redirects based on auth state.

```typescript
// src/routes/index.tsx
import { Navigate } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { css } from '../../styled-system/css'

export default function IndexPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bg: 'bg',
        })}
      >
        <div
          className={css({
            width: '8',
            height: '8',
            border: '4px solid token(colors.border)',
            borderTopColor: 'accent.default',
            borderRadius: 'full',
            animation: 'spin 1s linear infinite',
          })}
        />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}
```

---

## Step 12: Create placeholder route files

Four placeholder pages. Each renders a heading so navigation can be verified.

### `src/routes/dashboard.tsx`

```typescript
// src/routes/dashboard.tsx
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
```

### `src/routes/transactions.tsx`

```typescript
// src/routes/transactions.tsx
import { css } from '../../styled-system/css'

export default function TransactionsPage() {
  return (
    <div>
      <h1
        className={css({
          fontSize: '3xl',
          fontWeight: 'bold',
          color: 'fg',
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
```

### `src/routes/budgets.tsx`

```typescript
// src/routes/budgets.tsx
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
```

### `src/routes/categories.tsx`

```typescript
// src/routes/categories.tsx
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
```

---

## Step 13: Create `.env.local`

Environment variables for local Supabase. Get actual values from `supabase status`.

```bash
# .env.local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<paste from supabase status → anon key>
VITE_DEV_AUTOLOGIN=true
```

**How to get values:**

```bash
supabase status
# Copy "API URL" → VITE_SUPABASE_URL
# Copy "anon key" → VITE_SUPABASE_ANON_KEY
```

**Note:** The `src/lib/supabase.ts` file from Plan 1B should already use `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`. Verify it looks like this:

```typescript
// src/lib/supabase.ts (should already exist from Plan 1B)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'budget-tracker-auth-storage',
  },
})
```

---

## Step 14: Verify everything works

Run these checks in order:

### 14a. Dev server starts

```bash
npm run dev
```

Expect: Vite dev server starts on `localhost:5173` (or configured port) without errors.

### 14b. Auto-login works

Open `http://localhost:5173` in the browser. With `VITE_DEV_AUTOLOGIN=true`, the app should:
1. Briefly show loading spinner on index page
2. Auto-sign in with `dev@budgettracker.local`
3. Redirect to `/dashboard`
4. Show the dashboard layout with sidebar and topbar

If auto-login fails, check:
- Supabase is running (`supabase status`)
- Seed user exists (`dev@budgettracker.local` / `devpassword123` — should be created by Plan 1B seed)
- `.env.local` values match `supabase status` output

### 14c. Navigation works

Click each sidebar link:
- **Dashboard** → shows "Dashboard" heading at `/dashboard`
- **Transactions** → shows "Transactions" heading at `/transactions`
- **Budgets** → shows "Budgets" heading at `/budgets`
- **Categories** → shows "Categories" heading at `/categories`

Active nav item should be visually highlighted.

### 14d. Theme toggle works

Click the sun/moon icon in the topbar:
- Light → Dark: `<html>` gets `dark` class, background/text colors change
- Dark → Light: `dark` class removed, colors revert
- Refresh page: theme persists (stored in localStorage)

### 14e. Auth guard works

1. Sign out via the sidebar "Sign out" button
2. Expect redirect to `/login`
3. Try navigating to `/dashboard` directly → should redirect to `/login`
4. Log in with `dev@budgettracker.local` / `devpassword123` → redirects to `/dashboard`

### 14f. Register page works

1. Navigate to `/register`
2. Form renders with email, password, confirm password fields
3. Mismatched passwords show error
4. Successful registration redirects to `/login`

### 14g. React Query DevTools

In development, a small React Query Devtools button should appear in the bottom-right corner of the page. Click to expand and see query cache state.

---

## File Inventory

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add react-router, @tanstack/react-query, @tanstack/react-query-devtools |
| `src/lib/query-client.ts` | Create | React Query client singleton |
| `src/hooks/use-auth.ts` | Create | Auth state management + dev auto-login |
| `src/hooks/use-theme.ts` | Create | Dark mode toggle + localStorage persistence |
| `src/app.tsx` | Create | Router + providers |
| `src/main.tsx` | Create | Entry point |
| `index.html` | Modify | Root div + script tag |
| `src/routes/_layout.tsx` | Create | Dashboard shell (sidebar, topbar, auth guard) |
| `src/routes/login.tsx` | Create | Login form |
| `src/routes/register.tsx` | Create | Registration form |
| `src/routes/index.tsx` | Create | Auth-aware redirect |
| `src/routes/dashboard.tsx` | Create | Placeholder |
| `src/routes/transactions.tsx` | Create | Placeholder |
| `src/routes/budgets.tsx` | Create | Placeholder |
| `src/routes/categories.tsx` | Create | Placeholder |
| `.env.local` | Create | Supabase URL + anon key + dev auto-login flag |

## Assumptions

- **Plan 1A completed:** Vite+ scaffold exists, Panda CSS configured, Park UI components (button, card, input, label) installed to `src/components/ui/`. `styled-system` directory generated by Panda CSS. `tsconfig.json` has `@/*` path alias pointing to `src/*`.
- **Plan 1B completed:** `src/lib/supabase.ts` exports a Supabase client singleton using `import.meta.env.VITE_*` vars. `src/types/database.ts` exists with type definitions. Supabase local instance running with migrations applied and seed data including a dev user (`dev@budgettracker.local` / `devpassword123`).
- **Park UI component API:** Park UI with Panda CSS uses compound component pattern — `Card.Root`, `Card.Header`, `Card.Title`, `Card.Description`, `Card.Body`, `Card.Footer`. Button accepts `width` prop. Input and Label are standard form components.
- **Panda CSS imports:** `css()` function from `../../styled-system/css` (relative path depends on file depth; `@/` alias may not cover generated `styled-system` dir). Semantic tokens like `bg`, `fg`, `fg.muted`, `border`, `accent.default` are defined in `panda.config.ts` from Plan 1A.
- **lucide-react** is available (should be installed in Plan 1A as icon library).
