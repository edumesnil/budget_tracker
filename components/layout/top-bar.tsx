"use client"

import { PanelLeftOpen, PanelLeftClose, LogOut, Settings, MoonStar, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useSidebar } from "@/hooks/use-sidebar"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "next-themes"
import Link from "next/link"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TopBar() {
  const { collapsed, toggleSidebar } = useSidebar()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  const handleSignOut = async () => {
    await signOut()
  }

  const isDarkMode = theme === "dark"

  const handleThemeToggle = () => {
    setTheme(isDarkMode ? "light" : "dark")
  }

  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-4 py-7 bg-background sticky top-0 z-10">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Sun className={`h-4 w-4 ${!isDarkMode ? "text-[#95CA63]" : "text-muted-foreground"}`} />
          <Switch
            checked={isDarkMode}
            onCheckedChange={handleThemeToggle}
            className="data-[state=checked]:bg-theme-purple data-[state=unchecked]:bg-[#95CA63]"
            aria-label="Toggle theme"
          />
          <MoonStar className={`h-4 w-4 ${isDarkMode ? "text-theme-purple" : "text-muted-foreground"}`} />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 p-0 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://avatars.githubusercontent.com/u/124599?v=4" alt="User avatar" />
                <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Link href="/dashboard/settings" className="flex items-center w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

