import { createMiddlewareClient as originalCreateMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Database } from "@/types/supabase"

// Helper function to mask sensitive values
function maskValue(value?: string): string {
  if (!value) return "undefined"
  if (value.length <= 8) return "***" + value.length
  return `${value.substring(0, 3)}...${value.substring(value.length - 3)} (${value.length} chars)`
}

// Create a wrapper function instead of reassigning the constant
function createMiddlewareClient(args: { req: NextRequest; res: NextResponse }) {
  console.log("[Middleware] Using wrapped createMiddlewareClient")
  return originalCreateMiddlewareClient<Database>(args)
}

// Store middleware clients in a Map keyed by request URL
// This won't persist between requests, but will help during a single request lifecycle
const middlewareClients = new Map()

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Generate a unique request ID for tracing this request through logs
  const requestId = crypto.randomUUID().substring(0, 8)

  // Skip middleware for public routes and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/"
  ) {
    return res
  }

  console.log(`[Middleware:${requestId}] Processing request for ${pathname}`)

  try {
    // Check if Supabase environment variables are available
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error(`[Middleware:${requestId}] Missing Supabase environment variables`, {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      })

      // Redirect with specific error about missing API keys
      if (pathname.startsWith("/dashboard")) {
        const redirectUrl = new URL("/auth/login", req.url)
        redirectUrl.searchParams.set("error", "config")
        redirectUrl.searchParams.set("message", "Missing API configuration")
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Use a request-specific key for the middleware client
    const clientKey = `${req.nextUrl.origin}:${pathname}`

    let supabase

    // Check if we already have a client for this request path
    if (middlewareClients.has(clientKey)) {
      console.log(`[Middleware:${requestId}] Reusing existing Supabase client for middleware`)
      supabase = middlewareClients.get(clientKey)
    } else {
      console.log(`[Middleware:${requestId}] Creating Supabase client for middleware`)
      supabase = createMiddlewareClient({ req, res })

      // Store the client for potential reuse
      middlewareClients.set(clientKey, supabase)

      // Clean up after a delay
      setTimeout(() => {
        if (middlewareClients.has(clientKey)) {
          middlewareClients.delete(clientKey)
        }
      }, 10000) // 10 seconds should be enough for most middleware operations
    }

    // Get authenticated user instead of just the session
    console.log(`[Middleware:${requestId}] Getting authenticated user`)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error(`[Middleware:${requestId}] User authentication error:`, {
        code: userError.code,
        message: userError.message,
        status: userError.status,
      })
      throw userError
    }

    // Log user details (safely)
    if (user) {
      console.log(`[Middleware:${requestId}] Authenticated user found`, {
        userId: user.id,
        email: user.email
          ? `${user.email.substring(0, 3)}***${user.email.substring(user.email.lastIndexOf("@"))}`
          : null,
        role: user.role,
      })

      // Get session for additional checks if needed
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        console.log(`[Middleware:${requestId}] Session found`, {
          expiresAt: new Date(session.expires_at! * 1000).toISOString(),
        })
      }
    } else {
      console.log(`[Middleware:${requestId}] No authenticated user found`)
    }

    // If accessing dashboard routes without an authenticated user, redirect to login
    if (pathname.startsWith("/dashboard") && !user) {
      console.log(`[Middleware:${requestId}] Unauthorized access attempt to dashboard, redirecting to login`)
      const redirectUrl = new URL("/auth/login", req.url)
      redirectUrl.searchParams.set("error", "auth")
      redirectUrl.searchParams.set("message", "Please sign in to continue")
      redirectUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(redirectUrl)
    }

    console.log(`[Middleware:${requestId}] Request authorized for ${pathname}`)
    return res
  } catch (error: any) {
    // Enhanced error logging
    console.error(`[Middleware:${requestId}] Error:`, {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })

    // Determine specific error type
    let errorType = "unknown"
    let errorMessage = "An unexpected error occurred"

    if (error.message?.includes("JWT")) {
      errorType = "token"
      errorMessage = "Your session has expired"
    } else if (error.message?.includes("API key")) {
      errorType = "api-key"
      errorMessage = "Invalid API configuration"
    } else if (error.message?.includes("network")) {
      errorType = "network"
      errorMessage = "Network connection error"
    } else if (error.message?.includes("session")) {
      errorType = "session"
      errorMessage = "Session validation failed"
    }

    // On error, redirect to login for dashboard routes
    if (pathname.startsWith("/dashboard")) {
      console.log(`[Middleware:${requestId}] Redirecting to login due to error: ${errorType}`)
      const redirectUrl = new URL("/auth/login", req.url)
      redirectUrl.searchParams.set("error", errorType)
      redirectUrl.searchParams.set("message", errorMessage)
      redirectUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(redirectUrl)
    }

    return res
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
