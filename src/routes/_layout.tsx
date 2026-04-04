import { Outlet, Navigate, NavLink, useLocation } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { css } from '../../styled-system/css'
import { Spinner } from '@/components/ui/spinner'
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
  const isDark = theme === 'dark'
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bg: 'bg.canvas',
        })}
      >
        <Spinner
          className={css({
            width: '8',
            height: '8',
            color: 'teal.default',
          })}
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const initial = user.email?.charAt(0).toUpperCase() ?? 'U'

  return (
    <div
      className={css({
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
      })}
    >
      {/* Sidebar — always dark, tool-panel feel */}
      <aside
        className={css({
          display: 'flex',
          flexDirection: 'column',
          width: '56',
          minWidth: '56',
          height: '100vh',
          bg: 'sidebarBg',
          borderRight: '1px solid',
          borderColor: 'sidebarBorder',
          flexShrink: 0,
        })}
      >
        {/* Wordmark */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2.5',
            px: '5',
            py: '4',
            borderBottom: '1px solid',
            borderColor: 'sidebarBorder',
          })}
        >
          <div
            className={css({
              width: '6',
              height: '6',
              rounded: 'sm',
              bg: 'teal.9',
              flexShrink: 0,
            })}
          />
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: '600',
              letterSpacing: 'tight',
              color: 'sidebarFg',
            })}
          >
            Budget
          </span>
        </div>

        {/* Navigation */}
        <nav
          className={css({
            flex: 1,
            py: '3',
            px: '2',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5',
            overflowY: 'auto',
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
                  gap: '2.5',
                  px: '3',
                  py: '2',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  fontWeight: isActive ? '500' : '400',
                  transition: 'background 150ms ease, color 150ms ease',
                  color: isActive ? 'sidebarFg' : 'sidebarFgMuted',
                  bg: isActive ? 'sidebarActive' : 'transparent',
                  textDecoration: 'none',
                  _hover: {
                    bg: 'sidebarHover',
                    color: 'sidebarFg',
                  },
                })
              }
            >
              <Icon size={16} strokeWidth={checkActive(to, location.pathname) ? 2 : 1.5} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div
          className={css({
            borderTop: '1px solid',
            borderColor: 'sidebarBorder',
            p: '3',
            display: 'flex',
            flexDirection: 'column',
            gap: '1',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2.5',
              px: '2',
              py: '1.5',
            })}
          >
            <div
              className={css({
                width: '7',
                height: '7',
                borderRadius: 'full',
                bg: 'teal.dark.4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'xs',
                fontWeight: '600',
                color: 'teal.dark.11',
                flexShrink: 0,
              })}
            >
              {initial}
            </div>
            <p
              className={css({
                fontSize: 'xs',
                color: 'sidebarFgMuted',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              })}
            >
              {user.email}
            </p>
          </div>

          <button
            onClick={() => signOut()}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2.5',
              width: 'full',
              px: '3',
              py: '2',
              borderRadius: 'md',
              fontSize: 'sm',
              color: 'sidebarFgMuted',
              cursor: 'pointer',
              bg: 'transparent',
              border: 'none',
              textAlign: 'left',
              _hover: {
                bg: 'sidebarHover',
                color: 'sidebarFg',
              },
              transition: 'background 150ms ease, color 150ms ease',
            })}
          >
            <LogOut size={14} />
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
          bg: 'bg.canvas',
        })}
      >
        {/* Topbar */}
        <header
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            height: '12',
            px: '6',
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
            bg: 'bg.canvas',
            flexShrink: 0,
          })}
        >
          <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '8',
              height: '8',
              borderRadius: 'md',
              border: 'none',
              bg: 'transparent',
              color: 'fg.subtle',
              cursor: 'pointer',
              _hover: {
                bg: 'bg.subtle',
                color: 'fg.default',
              },
              transition: 'background 150ms ease, color 150ms ease',
            })}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>

        {/* Page content */}
        <main
          className={css({
            flex: 1,
            overflow: 'auto',
            bg: 'bg.canvas',
            color: 'fg.default',
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

// Helper to derive active state for icon stroke outside NavLink callback scope
function checkActive(to: string, pathname: string): boolean {
  if (to === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(to)
}
