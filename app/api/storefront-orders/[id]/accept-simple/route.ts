import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Just return a success response without doing any database operations
    return NextResponse.json({
      success: true,
      message: "Simple accept endpoint working",
      orderId: params.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Error in simple accept endpoint:", error)
    return NextResponse.json(
      {
        error: "An error occurred",
        message: error.message || String(error),
      },
      { status: 500 },
    )
  }
}
