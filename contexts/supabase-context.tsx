"use client"

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react"
import type { SupabaseClient } from "@supabase/auth-helpers-nextjs"
import type { Session, User } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { getSupabaseClient } from "@/lib/supabase-client"

// Track context initialization globally
let contextInitialized = false
let providerInstanceCount = 0

type SupabaseContextType = {
  supabase: SupabaseClient<Database>
  session: Session | null
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

// Create context
const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

// Provider component
export function SupabaseProvider({ children }: { children: ReactNode }) {
  const instanceId = useRef(++providerInstanceCount)

  useEffect(() => {
    console.log(`[SupabaseContext] Provider instance ${instanceId.current} mounted`)
    return () => {
      console.log(`[SupabaseContext] Provider instance ${instanceId.current} unmounted`)
    }
  }, [])

  // Use the singleton pattern instead of creating a new instance
  const [supabase] = useState(() => {
    if (contextInitialized) {
      console.log("[SupabaseContext] Reusing existing context")
      return getSupabaseClient()
    }

    console.log("[SupabaseContext] Getting Supabase client instance (first initialization)")
    contextInitialized = true
    return getSupabaseClient()
  })

  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    // Get initial session and user with the secure method
    const getInitialAuth = async () => {
      try {
        console.log("[SupabaseContext] Getting initial auth data")

        // Use getUser() instead of getSession() for better security
        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError) {
          console.error("[SupabaseContext] Error getting user", {
            code: userError.code,
            message: userError.message,
          })
          setSession(null)
          setUser(null)
          setIsLoading(false)
          return
        }

        // If we have a user, get their session
        if (userData.user) {
          const { data: sessionData } = await supabase.auth.getSession()

          if (sessionData.session) {
            console.log("[SupabaseContext] Initial auth data retrieved", {
              userId: userData.user.id,
              expiresAt: new Date(sessionData.session.expires_at! * 1000).toISOString(),
            })
            setSession(sessionData.session)
          } else {
            console.log("[SupabaseContext] User found but no active session")
          }

          setUser(userData.user)
        } else {
          console.log("[SupabaseContext] No authenticated user found")
          setSession(null)
          setUser(null)
        }
      } catch (error) {
        console.error("[SupabaseContext] Exception getting initial auth data", {
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        setIsLoading(false)
      }
    }

    getInitialAuth()

    // Listen for auth changes
    console.log("[SupabaseContext] Setting up auth state change listener")
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[SupabaseContext] Auth state changed: ${_event}`, {
        hasSession: !!session,
        userId: session?.user?.id,
      })

      // When auth state changes, use getUser() to verify the user
      if (session) {
        const { data } = await supabase.auth.getUser()
        setUser(data.user)
        setSession(session)
      } else {
        setUser(null)
        setSession(null)
      }
    })

    return () => {
      console.log("[SupabaseContext] Cleaning up auth state change listener")
      subscription.unsubscribe()
    }
  }, [supabase])

  // Authentication methods
  const signIn = async (email: string, password: string) => {
    console.log("[SupabaseContext] Sign-in attempt", {
      email: email.substring(0, 3) + "***" + email.substring(email.lastIndexOf("@")),
    })

    try {
      console.log("[SupabaseContext] Calling auth.signInWithPassword")
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("[SupabaseContext] Sign-in error", {
          code: error.code,
          message: error.message,
          status: error.status,
        })
        throw error
      }

      if (data?.session) {
        console.log("[SupabaseContext] Sign-in successful", {
          userId: data.user?.id,
          sessionExpiry: new Date(data.session.expires_at! * 1000).toISOString(),
        })

        // Verify the user with getUser after sign in
        const { data: userData } = await supabase.auth.getUser()
        setUser(userData.user)

        toast({
          title: "Sign in successful",
          description: "Redirecting to dashboard...",
        })

        router.refresh()
        router.push("/dashboard")
      } else {
        console.error("[SupabaseContext] Sign-in returned no session")
        throw new Error("Authentication failed - no session returned")
      }
    } catch (error: any) {
      console.error("[SupabaseContext] Sign-in exception", {
        name: error.name,
        message: error.message,
      })

      toast({
        variant: "destructive",
        title: "Authentication error",
        description: error.message || "An error occurred during sign in",
      })
      throw error
    }
  }

  const signUp = async (email: string, password: string) => {
    console.log("[SupabaseContext] Sign-up attempt", {
      email: email.substring(0, 3) + "***" + email.substring(email.lastIndexOf("@")),
    })

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("[SupabaseContext] Sign-up error", {
          code: error.code,
          message: error.message,
        })
        throw error
      }

      console.log("[SupabaseContext] Sign-up successful")

      toast({
        title: "Verification email sent",
        description: "Please check your email to verify your account.",
      })
    } catch (error: any) {
      console.error("[SupabaseContext] Sign-up exception", {
        name: error.name,
        message: error.message,
      })

      toast({
        variant: "destructive",
        title: "Registration error",
        description: error.message || "An error occurred during registration",
      })
      throw error
    }
  }

  const signOut = async () => {
    console.log("[SupabaseContext] Sign-out attempt")

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("[SupabaseContext] Sign-out error", {
          code: error.code,
          message: error.message,
        })
        throw error
      }

      console.log("[SupabaseContext] Sign-out successful")

      toast({
        title: "Signed out successfully",
      })

      router.refresh()
      router.push("/")
    } catch (error: any) {
      console.error("[SupabaseContext] Sign-out exception", {
        name: error.name,
        message: error.message,
      })

      toast({
        variant: "destructive",
        title: "Sign out error",
        description: error.message || "An error occurred during sign out",
      })
    }
  }

  const value = {
    supabase,
    session,
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
  }

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>
}

// Hook for using the Supabase client
export function useSupabase() {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider")
  }
  return context.supabase
}

// Hook for using auth state and methods
export function useAuth() {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error("useAuth must be used within a SupabaseProvider")
  }

  return {
    session: context.session,
    user: context.user,
    isLoading: context.isLoading,
    signIn: context.signIn,
    signUp: context.signUp,
    signOut: context.signOut,
  }
}
