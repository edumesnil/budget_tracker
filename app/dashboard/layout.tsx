"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"
import { Home, CreditCard, PieChart, Settings, Tag, DollarSign } from "lucide-react"
import { SidebarContext } from "@/contexts/sidebar-context"
import { TopBar } from "@/components/layout/top-bar"
import { Logo } from "@/components/logo"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  // Check for saved sidebar state on mount
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed")
    if (savedState) {
      setCollapsed(savedState === "true")
    }
  }, [])

  const toggleSidebar = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", String(newState))
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  // Don't render anything if not logged in
  if (!user) {
    return null
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggleSidebar }}>
      <div className="flex h-screen overflow-hidden">
        {/* Fixed Sidebar */}
        <aside
          className="group flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out data-[collapsed=true]:w-16 w-64 h-screen sticky top-0 z-30 flex-shrink-0 min-w-[16rem] data-[collapsed=true]:min-w-[4rem]"
          data-collapsed={collapsed}
          id="sidebar"
        >
          {/* Sidebar Header with Logo */}
          <div className="flex items-center p-4 shrink-0">
            <Logo />
          </div>

          <nav className="flex-1 p-3 overflow-y-auto sidebar-scrollbar">
            <ul className="space-y-2">
              <li>
                <NavItem href="/dashboard" icon={<Home className="h-5 w-5" />} label="Dashboard" pathname={pathname} />
              </li>
              <li>
                <NavItem
                  href="/dashboard/transactions"
                  icon={<CreditCard className="h-5 w-5" />}
                  label="Transactions"
                  pathname={pathname}
                />
              </li>
              <li>
                <NavItem
                  href="/dashboard/budget"
                  icon={<DollarSign className="h-5 w-5" />}
                  label="Budget"
                  pathname={pathname}
                />
              </li>
              <li>
                <NavItem
                  href="/dashboard/categories"
                  icon={<Tag className="h-5 w-5" />}
                  label="Categories"
                  pathname={pathname}
                />
              </li>
              <li>
                <NavItem
                  href="/dashboard/reports"
                  icon={<PieChart className="h-5 w-5" />}
                  label="Reports"
                  pathname={pathname}
                />
              </li>
            </ul>
          </nav>

          {/* Settings menu item at the bottom instead of user section */}
          <div className="mt-auto border-t border-sidebar-border/30 p-3 shrink-0">
            <NavItem
              href="/dashboard/settings"
              icon={<Settings className="h-5 w-5" />}
              label="Settings"
              pathname={pathname}
            />
          </div>
        </aside>

        {/* Main content with top bar */}
        <div className="flex flex-1 flex-col overflow-x-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-background text-foreground">
            <div className="p-4 md:p-8">{children}</div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}

// NavItem Component with active state based on pathname
function NavItem({
  href,
  icon,
  label,
  pathname,
}: { href: string; icon: React.ReactNode; label: string; pathname: string }) {
  const isActive = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href))

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 h-10 group-data-[collapsed=true]:justify-left rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ${
        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground"
      }`}
      aria-label={label}
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-md shrink-0">{icon}</div>
      <span className="truncate group-data-[collapsed=true]:hidden">{label}</span>
    </Link>
  )
}

