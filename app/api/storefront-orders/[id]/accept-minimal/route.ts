import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseRouteHandler } from "@/lib/supabase-route-handler"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Just initialize Supabase and return success
    const supabase = getSupabaseRouteHandler()

    return NextResponse.json({
      success: true,
      message: "Minimal accept endpoint working",
      orderId: params.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Error in minimal accept endpoint:", error)
    return NextResponse.json(
      {
        error: "An error occurred",
        message: error.message || String(error),
      },
      { status: 500 },
    )
  }
}
