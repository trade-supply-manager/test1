// Create or update the API route for sending purchase order confirmation emails

import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { sendPurchaseOrderConfirmation } from "@/lib/email/send-purchase-order-confirmation"
import { log, LogLevel } from "@/lib/debug-utils"
import type { Database } from "@/types/supabase"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })

    // Verify authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Modify the request body parsing to accept both orderId and purchaseOrderId
    // Parse request body
    const body = await request.json()
    const {
      purchaseOrderId: explicitPurchaseOrderId,
      orderId,
      contactIds = [],
      employeeIds = [],
      includePrimaryContact = false,
      customMessage,
      subject,
    } = body

    // Use purchaseOrderId if provided, otherwise fall back to orderId
    const purchaseOrderId = explicitPurchaseOrderId || orderId

    if (!purchaseOrderId) {
      return NextResponse.json({ success: false, error: "Purchase order ID is required" }, { status: 400 })
    }

    log(LogLevel.INFO, "send-purchase-order-confirmation", `Sending email for purchase order: ${purchaseOrderId}`)

    // Send the email
    const result = await sendPurchaseOrderConfirmation({
      supabase,
      orderId: purchaseOrderId,
      contactIds,
      employeeIds,
      includePrimaryContact,
      customMessage,
      subject,
    })

    if (result.success) {
      log(LogLevel.INFO, "send-purchase-order-confirmation", "Email sent successfully", result)
      return NextResponse.json(result)
    } else {
      log(LogLevel.ERROR, "send-purchase-order-confirmation", "Failed to send email", result)
      return NextResponse.json(result, { status: 500 })
    }
  } catch (error) {
    log(LogLevel.ERROR, "send-purchase-order-confirmation", "Unexpected error", error)
    return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 })
  }
}
