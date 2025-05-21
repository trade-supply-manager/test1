import { createServerComponentClient as originalCreateServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Create a wrapper function for createServerComponentClient that adds logging
export function createServerComponentClient<T = any>(...args: any[]) {
  console.log("[ServerSupabase] Intercepted createServerComponentClient call")

  // We still need to create a new client for each request context
  // But we'll use a more aggressive approach to track and log these
  const client = originalCreateServerComponentClient<T>(...args)

  console.log("[ServerSupabase] Created server component client")

  return client
}

// Create a single instance of the Supabase client for server components
let supabaseServerClient: ReturnType<typeof createClient<Database>> | null = null

/**
 * Creates a Supabase client for use in server components using service role
 * This provides admin access and should be used carefully
 */
export function getSupabaseServer() {
  if (supabaseServerClient) {
    return supabaseServerClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables")
  }

  supabaseServerClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return supabaseServerClient
}

/**
 * For backward compatibility with any components using the original function
 */
export const getSupabaseServerClient = getSupabaseServer

// Global cache for server component clients (keyed by request ID)
const SERVER_COMPONENT_CLIENTS = new Map()

/**
 * Creates a Supabase client for server components with user context
 * This uses the user's session from cookies
 */
export function getServerSupabaseClient() {
  // Generate a unique ID for this rendering context
  // In a real implementation, you might want to use a more stable ID based on the request
  const cookieStore = cookies()
  const contextId = cookieStore.toString() // Use the cookie string as a unique identifier

  // Check if we already have a client for this context
  if (SERVER_COMPONENT_CLIENTS.has(contextId)) {
    console.log("[ServerSupabase] Reusing existing client for this request context")
    return SERVER_COMPONENT_CLIENTS.get(contextId)
  }

  // Create a new client for this context
  console.log("[ServerSupabase] Creating new client for request context")
  const client = originalCreateServerComponentClient<Database>({ cookies })
  SERVER_COMPONENT_CLIENTS.set(contextId, client)

  // Clean up after a delay (assuming the request will be done by then)
  // This helps prevent memory leaks in development with fast refresh
  setTimeout(() => {
    if (SERVER_COMPONENT_CLIENTS.has(contextId)) {
      console.log("[ServerSupabase] Cleaning up client for request context")
      SERVER_COMPONENT_CLIENTS.delete(contextId)
    }
  }, 10000) // 10 seconds should be enough for most requests

  return client
}

/**
 * Export createServerSupabaseClient as an alias for getServerSupabaseClient
 * This ensures compatibility with existing code that uses this function name
 */
export const createServerSupabaseClient = getServerSupabaseClient
