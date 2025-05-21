import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().substring(0, 8)
  console.log(`[AuthCallback:${requestId}] Processing auth callback`)

  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code) {
    try {
      console.log(`[AuthCallback:${requestId}] Auth code found, creating Supabase client`)
      const supabase = createRouteHandlerClient({ cookies })

      console.log(`[AuthCallback:${requestId}] Exchanging auth code for session`)
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error(`[AuthCallback:${requestId}] Error exchanging code for session`, {
          code: error.code,
          message: error.message,
          status: error.status,
        })
        return NextResponse.redirect(
          new URL(`/auth/login?error=callback&message=${encodeURIComponent(error.message)}`, request.url),
        )
      }

      console.log(`[AuthCallback:${requestId}] Successfully exchanged code for session, redirecting to dashboard`)
      return NextResponse.redirect(new URL("/dashboard", request.url))
    } catch (error: any) {
      console.error(`[AuthCallback:${requestId}] Exception in auth callback`, {
        name: error.name,
        message: error.message,
      })
      return NextResponse.redirect(
        new URL(
          `/auth/login?error=callback&message=${encodeURIComponent(error.message || "Authentication error")}`,
          request.url,
        ),
      )
    }
  }

  console.error(`[AuthCallback:${requestId}] No auth code found in callback URL`)
  return NextResponse.redirect(new URL("/auth/login?error=callback&message=No authentication code found", request.url))
}
