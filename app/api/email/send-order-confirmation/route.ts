import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { ServerCustomerCommunicationLogger } from "@/lib/customer-communication-logger-server"
import { sendOrderConfirmation } from "@/lib/email/send-order-confirmation"
import { log, LogLevel } from "@/lib/debug-email-utils"

// Helper function to validate UUID
function isValidUuid(id: any): boolean {
  if (typeof id !== "string") {
    return false
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

export async function POST(request: NextRequest) {
  log(LogLevel.INFO, "API", "Order confirmation API route called")

  try {
    // Check environment variables with detailed logging
    const resendApiKey = process.env.RESEND_API_KEY
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    const debugEmail = process.env.DEBUG_EMAIL

    // Log environment variable status
    console.log("📧 Environment Variables Check:")
    console.log(`- RESEND_API_KEY: ${resendApiKey ? "✅ Set" : "❌ Not set"}`)
    console.log(`- NEXT_PUBLIC_BASE_URL: ${baseUrl ? "✅ Set" : "⚠️ Not set"}`)
    console.log(`- DEBUG_EMAIL: ${debugEmail ? "✅ Set to " + debugEmail : "⚠️ Not set"}`)

    if (debugEmail === "true") {
      log(LogLevel.DEBUG, "API", "DEBUG_EMAIL is enabled, extra logging will be shown")
    }

    if (!resendApiKey) {
      const errorMsg = "Missing RESEND_API_KEY environment variable"
      log(LogLevel.ERROR, "API", errorMsg)
      console.error(`❌ ${errorMsg}`)
      return NextResponse.json(
        {
          success: false,
          error: "Email service is not properly configured (missing API key)",
        },
        { status: 500 },
      )
    }

    if (!baseUrl) {
      log(LogLevel.WARN, "API", "Missing NEXT_PUBLIC_BASE_URL environment variable")
      console.warn("⚠️ Missing NEXT_PUBLIC_BASE_URL environment variable")
    }

    // Parse request body with detailed error handling
    let data
    try {
      data = await request.json()
      // Log the raw request data
      if (debugEmail === "true") {
        log(LogLevel.DEBUG, "API", "Raw request data", data)
        console.log("📧 Raw request data:", JSON.stringify(data, null, 2))
      }
    } catch (error) {
      const errorMsg = "Failed to parse request body"
      log(LogLevel.ERROR, "API", errorMsg, { error })
      console.error(`❌ ${errorMsg}:`, error)
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request format: Could not parse JSON body",
        },
        { status: 400 },
      )
    }

    // Ensure arrays are properly initialized
    let selectedContactIds = Array.isArray(data.selectedContactIds) ? data.selectedContactIds : []
    let selectedEmployeeIds = Array.isArray(data.selectedEmployeeIds) ? data.selectedEmployeeIds : []

    // Default includePrimaryContact to true unless explicitly set to false
    const includePrimaryContact = data.includePrimaryContact !== false

    log(LogLevel.INFO, "API", "Request data", {
      orderId: data.orderId,
      contactIds: selectedContactIds,
      employeeIds: selectedEmployeeIds,
      contactCount: selectedContactIds.length,
      employeeCount: selectedEmployeeIds.length,
      includePrimaryContact: includePrimaryContact,
    })

    console.log("📧 Request data processed:")
    console.log(`- Order ID: ${data.orderId}`)
    console.log(`- Contact IDs: ${selectedContactIds.length > 0 ? selectedContactIds.join(", ") : "None"}`)
    console.log(`- Employee IDs: ${selectedEmployeeIds.length > 0 ? selectedEmployeeIds.join(", ") : "None"}`)
    console.log(`- Include Primary Contact: ${includePrimaryContact ? "Yes" : "No"}`)

    const { orderId } = data

    // Validate required parameters
    if (!orderId) {
      const errorMsg = "Missing orderId in request"
      log(LogLevel.ERROR, "API", errorMsg)
      console.error(`❌ ${errorMsg}`)
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400 },
      )
    }

    // Validate orderId is a string
    if (typeof orderId !== "string") {
      const errorMsg = `Invalid orderId type: ${typeof orderId}. Expected string.`
      log(LogLevel.ERROR, "API", errorMsg)
      console.error(`❌ ${errorMsg}`)
      return NextResponse.json(
        {
          success: false,
          error: "Order ID must be a string",
        },
        { status: 400 },
      )
    }

    // Validate UUID format
    if (!isValidUuid(orderId)) {
      const errorMsg = `Invalid orderId format: ${orderId}`
      log(LogLevel.ERROR, "API", errorMsg)
      console.error(`❌ ${errorMsg}`)
      return NextResponse.json(
        {
          success: false,
          error: "Invalid order ID format",
        },
        { status: 400 },
      )
    }

    // Validate contact IDs
    const invalidContactIds = selectedContactIds.filter((id) => !isValidUuid(id))
    if (invalidContactIds.length > 0) {
      log(LogLevel.WARN, "API", "Invalid contact IDs detected", { invalidContactIds })
      console.warn("⚠️ Invalid contact IDs detected:", invalidContactIds)
      // Filter out invalid IDs
      const validContactIds = selectedContactIds.filter((id) => isValidUuid(id))
      log(LogLevel.INFO, "API", "Proceeding with valid contact IDs only", { validContactIds })
      console.log("📧 Proceeding with valid contact IDs only:", validContactIds)
      // Update the array
      selectedContactIds = validContactIds
    }

    // Validate employee IDs
    const invalidEmployeeIds = selectedEmployeeIds.filter((id) => !isValidUuid(id))
    if (invalidEmployeeIds.length > 0) {
      log(LogLevel.WARN, "API", "Invalid employee IDs detected", { invalidEmployeeIds })
      console.warn("⚠️ Invalid employee IDs detected:", invalidEmployeeIds)
      // Filter out invalid IDs
      const validEmployeeIds = selectedEmployeeIds.filter((id) => isValidUuid(id))
      log(LogLevel.INFO, "API", "Proceeding with valid employee IDs only", { validEmployeeIds })
      console.log("📧 Proceeding with valid employee IDs only:", validEmployeeIds)
      // Update the array
      selectedEmployeeIds = validEmployeeIds
    }

    // Get order details from database
    const supabase = getSupabaseServer()
    const { data: order, error: orderError } = await supabase
      .from("customer_orders")
      .select("*, customers(customer_name, email)")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      const errorMsg = orderError ? `Error fetching order details: ${orderError.message}` : "Order not found"
      log(LogLevel.ERROR, "API", errorMsg, { orderId, error: orderError })
      console.error(`❌ ${errorMsg}`)
      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
        },
        { status: orderError ? 500 : 404 },
      )
    }

    log(LogLevel.INFO, "API", "Calling sendOrderConfirmation function", {
      orderId,
      selectedContactIds,
      selectedEmployeeIds,
      includePrimaryContact,
    })

    console.log("📧 Calling sendOrderConfirmation function with:")
    console.log(`- Order ID: ${orderId}`)
    console.log(`- Selected Contact IDs: ${selectedContactIds.length}`)
    console.log(`- Selected Employee IDs: ${selectedEmployeeIds.length}`)
    console.log(`- Include Primary Contact: ${includePrimaryContact}`)

    const result = await sendOrderConfirmation(order, selectedContactIds, selectedEmployeeIds, includePrimaryContact)

    if (!result.success) {
      log(LogLevel.ERROR, "API", "Email sending failed", { error: result.error })
      console.error("❌ Email sending failed:", result.error)
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to send order confirmation email",
        },
        { status: 500 },
      )
    }

    log(LogLevel.INFO, "API", "Email sent successfully")
    console.log("✅ Email sent successfully")

    // Log the email to customer_email_logs if primary contact was included
    if (includePrimaryContact && order.customers?.email) {
      await ServerCustomerCommunicationLogger.logCommunication({
        customer_id: order.customer_id,
        order_id: orderId,
        email_address: order.customers.email,
        subject: `Order Confirmation: ${order.order_name}`,
        communication_method: "email",
        status: "sent",
      })
    }

    return NextResponse.json(
      {
        success: true,
        message: "Email sent successfully",
      },
      { status: 200 },
    )
  } catch (error) {
    log(LogLevel.ERROR, "API", "Unexpected error in API route", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    console.error("❌ Unexpected error in API route:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}
