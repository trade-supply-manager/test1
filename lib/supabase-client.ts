"use client"

import { createClientComponentClient as originalCreateClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { SupabaseClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"

// Use a module-level variable for the singleton instance
let supabaseClientInstance: SupabaseClient<Database> | null = null

// Track initialization status
let isInitialized = false

// Create a wrapper function instead of reassigning the original
export function createClientComponentClient<T = any>(...args: any[]): SupabaseClient<T> {
  console.log("[SupabaseClient] Intercepted createClientComponentClient call")

  if (supabaseClientInstance) {
    console.log("[SupabaseClient] Returning existing singleton instance")
    // @ts-ignore - Type casting
    return supabaseClientInstance as SupabaseClient<T>
  }

  console.log("[SupabaseClient] Creating new singleton instance")
  // @ts-ignore - Type casting
  supabaseClientInstance = originalCreateClientComponentClient<Database>(...args)
  isInitialized = true

  // @ts-ignore - Type casting
  return supabaseClientInstance as SupabaseClient<T>
}

export function getSupabaseClient(): SupabaseClient<Database> {
  // Only create a client if we're in the browser and one doesn't exist
  if (!isInitialized) {
    if (typeof window !== "undefined") {
      try {
        console.log("[SupabaseClient] Initializing client-side Supabase client")

        // Check for required environment variables
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.error("[SupabaseClient] Missing required Supabase environment variables")
          throw new Error("Missing required Supabase environment variables")
        }

        // Use our wrapper function instead of the original
        supabaseClientInstance = createClientComponentClient<Database>()
        isInitialized = true

        console.log("[SupabaseClient] Client-side Supabase client initialized successfully")
      } catch (error) {
        console.error("[SupabaseClient] Failed to initialize client-side Supabase client", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    } else {
      console.error("[SupabaseClient] getSupabaseClient called in server context")
      throw new Error("getSupabaseClient should not be called in server context. Use getServerSupabaseClient instead.")
    }
  } else {
    console.log("[SupabaseClient] Returning existing client instance")
  }

  if (!supabaseClientInstance) {
    console.error("[SupabaseClient] Client instance is null after initialization")
    throw new Error("Failed to initialize Supabase client")
  }

  return supabaseClientInstance
}

// For debugging - expose whether the singleton has been initialized
export function isSupabaseClientInitialized(): boolean {
  return isInitialized
}

// For debugging - expose the current singleton instance
export function getSupabaseClientInstance(): SupabaseClient<Database> | undefined {
  return supabaseClientInstance
}
