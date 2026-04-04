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
    let initialized = false

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()

        // Dev auto-login: if no session and auto-login enabled, sign in with seed user
        if (
          !currentSession &&
          import.meta.env.VITE_DEV_AUTOLOGIN === 'true' &&
          import.meta.env.DEV
        ) {
          const { data } = await supabase.auth.signInWithPassword({
            email: 'dev@budgettracker.local',
            password: 'password123',
          })
          if (mounted && data.session) {
            setSession(data.session)
            setUser(data.session.user)
          }
        } else if (mounted) {
          setSession(currentSession)
          setUser(currentSession?.user ?? null)
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        if (mounted) {
          initialized = true
          setIsLoading(false)
        }
      }
    }

    initAuth()

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Skip events fired before init completes — initAuth handles the initial state
        if (!initialized) return
        if (mounted) {
          setSession(newSession)
          setUser(newSession?.user ?? null)
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
    const { error, data } = await supabase.auth.signUp({ email, password })

    // If signup successful, also insert into public.users table
    if (!error && data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        email: data.user.email!,
      })
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
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
