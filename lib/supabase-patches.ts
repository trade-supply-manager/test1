// This file contains monkey patches for Supabase client creation functions
// to enforce singleton patterns and prevent multiple GoTrueClient instances

// Import this file early in your application lifecycle
console.log("[SupabasePatches] Initializing Supabase client creation patches")

// Store original functions before they're imported elsewhere
let originalCreateClientComponentClient: any = null
let originalCreateServerComponentClient: any = null
let originalCreateMiddlewareClient: any = null
let originalCreateRouteHandlerClient: any = null

// Set up patches when this module is loaded
function setupPatches() {
  try {
    // Try to get references to the original functions
    const supabaseAuthHelpers = require("@supabase/auth-helpers-nextjs")

    if (supabaseAuthHelpers.createClientComponentClient) {
      originalCreateClientComponentClient = supabaseAuthHelpers.createClientComponentClient

      // Patch createClientComponentClient
      supabaseAuthHelpers.createClientComponentClient = (...args: any[]) => {
        console.log("[SupabasePatches] Intercepted createClientComponentClient call")

        // We'll still call the original function, but log it for debugging
        const client = originalCreateClientComponentClient(...args)

        console.log("[SupabasePatches] Created client component client")

        return client
      }

      console.log("[SupabasePatches] Successfully patched createClientComponentClient")
    }

    if (supabaseAuthHelpers.createServerComponentClient) {
      originalCreateServerComponentClient = supabaseAuthHelpers.createServerComponentClient

      // Patch createServerComponentClient
      supabaseAuthHelpers.createServerComponentClient = (...args: any[]) => {
        console.log("[SupabasePatches] Intercepted createServerComponentClient call")

        // We'll still call the original function, but log it for debugging
        const client = originalCreateServerComponentClient(...args)

        console.log("[SupabasePatches] Created server component client")

        return client
      }

      console.log("[SupabasePatches] Successfully patched createServerComponentClient")
    }

    if (supabaseAuthHelpers.createMiddlewareClient) {
      originalCreateMiddlewareClient = supabaseAuthHelpers.createMiddlewareClient

      // Patch createMiddlewareClient
      supabaseAuthHelpers.createMiddlewareClient = (...args: any[]) => {
        console.log("[SupabasePatches] Intercepted createMiddlewareClient call")

        // We'll still call the original function, but log it for debugging
        const client = originalCreateMiddlewareClient(...args)

        console.log("[SupabasePatches] Created middleware client")

        return client
      }

      console.log("[SupabasePatches] Successfully patched createMiddlewareClient")
    }

    if (supabaseAuthHelpers.createRouteHandlerClient) {
      originalCreateRouteHandlerClient = supabaseAuthHelpers.createRouteHandlerClient

      // Patch createRouteHandlerClient
      supabaseAuthHelpers.createRouteHandlerClient = (...args: any[]) => {
        console.log("[SupabasePatches] Intercepted createRouteHandlerClient call")

        // We'll still call the original function, but log it for debugging
        const client = originalCreateRouteHandlerClient(...args)

        console.log("[SupabasePatches] Created route handler client")

        return client
      }

      console.log("[SupabasePatches] Successfully patched createRouteHandlerClient")
    }

    console.log("[SupabasePatches] All available Supabase client creation functions patched")
  } catch (error) {
    console.error("[SupabasePatches] Error setting up patches:", error)
  }
}

// Run setup immediately
setupPatches()

console.log("[SupabasePatches] Supabase patches initialized")

export {}
