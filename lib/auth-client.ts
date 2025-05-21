"use client"

import { useAuth } from "@/contexts/supabase-context"
import { useState } from "react"

export function useAuthClient() {
  const { signIn, signUp, signOut, user, session, isLoading } = useAuth()
  const [authLoading, setAuthLoading] = useState(false)

  const handleSignIn = async (email: string, password: string) => {
    setAuthLoading(true)
    try {
      await signIn(email, password)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignUp = async (email: string, password: string) => {
    setAuthLoading(true)
    try {
      await signUp(email, password)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    setAuthLoading(true)
    try {
      await signOut()
    } finally {
      setAuthLoading(false)
    }
  }

  return {
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    user,
    session,
    isLoading: isLoading || authLoading,
  }
}
