"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"

type User = {
  id: string
  email: string | null
}

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any; data: any }>
  signOut: () => Promise<void>
}

// Create context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => ({ error: new Error("Not implemented") }),
  signUp: async () => ({ error: new Error("Not implemented"), data: null }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Initialize auth state
  useEffect(() => {
    // Get the singleton instance
    const supabase = getSupabaseBrowser()
    let mounted = true

    // Check for existing session
    const initializeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()

        if (mounted) {
          if (data.session?.user) {
            setUser({
              id: data.session.user.id,
              email: data.session.user.email,
            })
          } else {
            setUser(null)
            // Redirect to login if on a protected route
            if (pathname?.startsWith("/dashboard")) {
              router.push("/login")
            }
          }
          setLoading(false)
        }
      } catch (error) {
        console.error("Error checking session:", error)
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
          })
        } else {
          setUser(null)
          // Redirect to login if on a protected route
          if (pathname?.startsWith("/dashboard")) {
            router.push("/login")
          }
        }
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [pathname, router])

  // Sign in function
  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  // Sign up function
  const signUp = async (email: string, password: string) => {
    const supabase = getSupabaseBrowser()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    // Create user record in our database if signup was successful
    if (!error && data.user) {
      try {
        await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email,
        })
      } catch (err) {
        console.error("Error creating user record:", err)
      }
    }

    return { data, error }
  }

  // Sign out function
  const signOut = async () => {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

