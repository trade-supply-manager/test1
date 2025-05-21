import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

// Keep track of client instance
let supabaseInstance: ReturnType<typeof createRouteHandlerClient<Database>> | null = null

/**
 * Creates a Supabase client for use in route handlers
 * with enhanced error handling and singleton pattern
 *
 * This is an alias for getSupabaseRouteHandler for backward compatibility
 */
export function getRouteSupabaseClient() {
  return getSupabaseRouteHandler()
}

/**
 * Creates a Supabase client for use in route handlers
 * with enhanced error handling and singleton pattern
 */
export function getSupabaseRouteHandler() {
  try {
    // Check for required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is missing")
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is missing")
    }

    // In route handlers, due to Next.js behavior, we need to be careful with singletons
    // because they might be reinitialized on each request
    if (!supabaseInstance) {
      supabaseInstance = createRouteHandlerClient<Database>({ cookies })
      console.log("[RouteHandler] Created new Supabase client instance")
    }

    return supabaseInstance
  } catch (error) {
    console.error("Error initializing Supabase client:", error)
    throw error // Re-throw to be caught by the withErrorHandling wrapper
  }
}

/**
 * Gets the authenticated user from the Supabase client
 * This is a secure way to get the user in route handlers
 */
export async function getAuthenticatedUser(supabase = getSupabaseRouteHandler()) {
  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      console.error("[RouteHandler] Error getting authenticated user:", {
        code: error.code,
        message: error.message,
      })
      return null
    }

    return data.user
  } catch (error) {
    console.error("[RouteHandler] Exception getting authenticated user:", error)
    return null
  }
}

/**
 * Gets the session from the Supabase client
 * This should be used in conjunction with getAuthenticatedUser for better security
 */
export async function getSession(supabase = getSupabaseRouteHandler()) {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error("[RouteHandler] Error getting session:", {
        code: error.code,
        message: error.message,
      })
      return null
    }

    return data.session
  } catch (error) {
    console.error("[RouteHandler] Exception getting session:", error)
    return null
  }
}
