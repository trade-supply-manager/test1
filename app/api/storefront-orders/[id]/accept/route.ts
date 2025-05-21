import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseRouteHandler } from "@/lib/supabase-route-handler"
import { withErrorHandling } from "@/lib/api-route-wrapper"

async function acceptOrderHandler(request: NextRequest, { params }: { params: { id: string } }) {
  console.log("Accept order API called for order ID:", params.id)

  // Initialize Supabase client (this might throw if environment variables are missing)
  const supabase = getSupabaseRouteHandler()

  // Parse request body
  const { notes } = await request.json()

  // Validate that the order exists and is in a valid state for acceptance
  const { data: order, error: fetchError } = await supabase
    .from("storefront_orders")
    .select("id, status, is_archived")
    .eq("id", params.id)
    .single()

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Check if the order is in a valid state for acceptance
  // Allow both "pending" and "rejected" orders to be accepted
  const allowedStatuses = ["pending", "rejected"]
  if (order.is_archived || !allowedStatuses.includes(order.status.toLowerCase())) {
    return NextResponse.json(
      { error: "Order cannot be accepted. It may be archived or in an invalid state." },
      { status: 400 },
    )
  }

  // Get current timestamp and user ID
  const timestamp = new Date().toISOString()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id

  // Update the order status to approved
  const { error: updateError } = await supabase
    .from("storefront_orders")
    .update({
      status: "Approved",
      notes: notes || null,
      date_last_updated: timestamp,
      updated_by_user_id: userId,
    })
    .eq("id", params.id)

  if (updateError) {
    console.error("Error updating order status:", updateError)
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
  }

  // Try to log the action, but don't fail if it doesn't work
  try {
    const { data: tableExists } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_name", "storefront_order_logs")
      .eq("table_schema", "public")

    // Only try to log if the table exists
    if (tableExists && tableExists.length > 0) {
      // Log the acceptance
      const { error: logError } = await supabase.from("storefront_order_logs").insert({
        order_id: params.id,
        action: "accept",
        notes: notes || "Order accepted",
        previous_status: order.status,
        new_status: "Approved",
        created_at: timestamp,
      })

      if (logError) {
        console.error("Error logging order acceptance:", logError)
        // Don't fail the request if logging fails
      }
    }
  } catch (logError) {
    console.error("Error checking for logs table:", logError)
    // Don't fail the request if logging fails
  }

  return NextResponse.json({
    success: true,
    message: "Order accepted successfully",
    orderId: params.id,
  })
}

// Export the wrapped handler
export const POST = withErrorHandling(acceptOrderHandler)
