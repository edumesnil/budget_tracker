import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/contexts/auth-context"
// Import the QueryClientProvider and ReactQueryDevtools
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { queryClient } from "@/lib/react-query"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Budget Tracker",
  description: "Track and manage your personal finances",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
            {process.env.NODE_ENV !== "production" && <ReactQueryDevtools initialIsOpen={false} />}
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

