import { Outlet, NavLink } from 'react-router'
import { useTheme } from '@/hooks/use-theme'
import { css } from '../../styled-system/css'
import { LayoutDashboard, ArrowLeftRight, PiggyBank, Tags, Sun, Moon } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/categories', label: 'Categories', icon: Tags },
] as const

export function DashboardLayout() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

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
          width: '60',
          minWidth: '60',
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
                  textDecoration: 'none',
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
          <button
            onClick={toggle}
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
