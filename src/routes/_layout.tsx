import { Outlet, Navigate, NavLink, useLocation } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { css } from '../../styled-system/css'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Tags,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/categories', label: 'Categories', icon: Tags },
] as const

export function DashboardLayout() {
  const { user, isLoading, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'center', h: '100vh' })}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return (
    <div className={css({ display: 'flex', h: '100vh', overflow: 'hidden' })}>
      {/* Sidebar */}
      <aside className={css({
        display: 'flex',
        flexDir: 'column',
        w: '56',
        minW: '56',
        h: '100vh',
        bg: 'gray.2',
        borderRight: '1px solid',
        borderColor: 'gray.4',
        flexShrink: 0,
      })}>
        {/* Title */}
        <div className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2.5',
          px: '5',
          py: '4',
          borderBottom: '1px solid',
          borderColor: 'gray.4',
        })}>
          <div className={css({ w: '6', h: '6', rounded: 'sm', bg: 'colorPalette.9', flexShrink: 0 })} />
          <span className={css({ fontSize: 'sm', fontWeight: '600', color: 'fg.default' })}>
            Budget Tracker
          </span>
        </div>

        {/* Nav */}
        <nav className={css({ flex: 1, py: '3', px: '2', display: 'flex', flexDir: 'column', gap: '0.5' })}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2.5',
                  px: '3',
                  py: '2',
                  rounded: 'md',
                  fontSize: 'sm',
                  fontWeight: isActive ? '500' : '400',
                  color: isActive ? 'fg.default' : 'fg.muted',
                  bg: isActive ? 'gray.3' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background 150ms, color 150ms',
                  _hover: { bg: 'gray.3', color: 'fg.default' },
                })
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className={css({ borderTop: '1px solid', borderColor: 'gray.4', p: '3' })}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '2.5', px: '2', py: '1.5' })}>
            <div className={css({
              w: '7', h: '7', rounded: 'full', bg: 'colorPalette.3',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'xs', fontWeight: '600', color: 'colorPalette.11',
            })}>
              {user.email?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <p className={css({ fontSize: 'xs', color: 'fg.muted', truncate: true, flex: 1 })}>
              {user.email}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className={css({
              display: 'flex', alignItems: 'center', gap: '2.5',
              w: 'full', px: '3', py: '2', rounded: 'md',
              fontSize: 'sm', color: 'fg.muted',
              cursor: 'pointer', bg: 'transparent', border: 'none',
              _hover: { bg: 'gray.3', color: 'fg.default' },
              transition: 'background 150ms, color 150ms',
            })}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={css({ display: 'flex', flexDir: 'column', flex: 1, overflow: 'hidden' })}>
        {/* Topbar */}
        <header className={css({
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          h: '12', px: '6', borderBottom: '1px solid', borderColor: 'gray.4',
        })}>
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className={css({
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              w: '8', h: '8', rounded: 'md', border: 'none',
              bg: 'transparent', color: 'fg.muted', cursor: 'pointer',
              _hover: { bg: 'gray.3', color: 'fg.default' },
            })}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        {/* Content */}
        <main className={css({ flex: 1, overflow: 'auto' })}>
          <div className={css({ p: { base: '4', md: '8' }, maxW: '7xl', mx: 'auto' })}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
