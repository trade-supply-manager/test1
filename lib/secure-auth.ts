import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

/**
 * Securely gets the authenticated user for server components
 * This is a wrapper around supabase.auth.getUser() which is more secure than getSession()
 */
export async function getAuthenticatedUser() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    console.error("[SecureAuth] Error getting authenticated user:", {
      code: error.code,
      message: error.message,
    })
    return null
  }

  return data.user
}

/**
 * Gets the session after verifying the user is authenticated
 * This should be used in conjunction with getAuthenticatedUser for better security
 */
export async function getSessionSafely() {
  const supabase = createServerComponentClient<Database>({ cookies })

  // First verify the user is authenticated
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    console.error("[SecureAuth] User authentication failed:", {
      code: userError?.code,
      message: userError?.message,
    })
    return null
  }

  // Then get the session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    console.error("[SecureAuth] Error getting session:", {
      code: sessionError.code,
      message: sessionError.message,
    })
    return null
  }

  return sessionData.session
}
