import { type NextRequest, NextResponse } from "next/server"

type RouteHandler = (req: NextRequest, params: any) => Promise<NextResponse>

/**
 * Wraps an API route handler with comprehensive error handling
 * Ensures all errors are caught and returned as JSON responses
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, params: any) => {
    try {
      // Execute the original handler
      return await handler(req, params)
    } catch (error: any) {
      console.error("Uncaught API route error:", error)

      // Ensure we return a proper JSON response even for uncaught errors
      return NextResponse.json(
        {
          error: "An unexpected error occurred",
          message: error.message || String(error),
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        },
        { status: 500 },
      )
    }
  }
}
