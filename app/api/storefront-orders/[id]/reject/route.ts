import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabaseClient } from "@/lib/supabase-server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getServerSupabaseClient()
    const { rejectionReason } = await request.json()

    if (!rejectionReason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    // Update the order status to "Rejected"
    const { error: updateError } = await supabase
      .from("storefront_orders")
      .update({
        status: "Rejected",
        reject_reason: rejectionReason,
        date_last_updated: new Date().toISOString(),
      })
      .eq("id", params.id)

    if (updateError) {
      console.error("Error rejecting order:", updateError)
      return NextResponse.json({ error: "Failed to reject the order" }, { status: 500 })
    }

    // Check if the storefront_order_logs table exists before trying to log
    const { data: tableExists, error: checkError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_name", "storefront_order_logs")
      .single()

    if (!checkError && tableExists) {
      // Log the rejection action only if the table exists
      try {
        await supabase.from("storefront_order_logs").insert({
          order_id: params.id,
          action: "reject",
          details: `Order rejected. Reason: ${rejectionReason}`,
          created_at: new Date().toISOString(),
        })
      } catch (logError) {
        // Just log the error but don't fail the request
        console.error("Error logging rejection (caught):", logError)
      }
    } else {
      console.log("Skipping logging: storefront_order_logs table does not exist")
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in reject route:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
