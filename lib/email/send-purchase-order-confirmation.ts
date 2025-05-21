import { getResendClient, type EmailType, sendEmail } from "./resend-client"
import { purchaseOrderConfirmationTemplate } from "./templates/purchase-order-confirmation"
import { log, LogLevel } from "@/lib/debug-utils"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { isValidEmail } from "@/lib/utils"

interface SendPurchaseOrderConfirmationProps {
  supabase: SupabaseClient<Database>
  orderId: string
  contactIds: string[]
  employeeIds: string[]
  includePrimaryContact: boolean
  customMessage?: string
  subject?: string
}

/**
 * Normalizes a URL by ensuring there are no double slashes between parts
 * @param base The base URL (may or may not end with a slash)
 * @param path The path to append (may or may not start with a slash)
 * @returns A properly formatted URL
 */
function normalizeUrl(base: string, path: string): string {
  // Remove trailing slash from base if present
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base

  // Ensure path starts with a slash
  const cleanPath = path.startsWith("/") ? path : `/${path}`

  return `${cleanBase}${cleanPath}`
}

/**
 * Fetches a PDF with retry logic for network issues
 * @param url The URL to fetch the PDF from
 * @param maxRetries Maximum number of retry attempts
 * @param initialDelay Initial delay between retries in ms
 * @returns Response object or null if all retries failed
 */
async function fetchPdfWithRetry(url: string, maxRetries = 3, initialDelay = 1000): Promise<Response | null> {
  let lastError: any = null
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add a cache-busting parameter to avoid cached redirects
      const cacheBuster = `_cb=${Date.now()}`
      const urlWithCacheBuster = url.includes("?") ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch(urlWithCacheBuster, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/pdf",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        signal: controller.signal,
        redirect: "follow", // Explicitly follow redirects
        cache: "no-store", // Ensure we don't use cached responses
      })

      clearTimeout(timeoutId)

      // Log detailed information about the response
      log(LogLevel.INFO, "fetchPdfWithRetry", `Attempt ${attempt + 1}: Response status ${response.status}`, {
        url: urlWithCacheBuster,
        redirected: response.redirected,
        redirectUrl: response.redirected ? response.url : null,
      })

      return response
    } catch (error: any) {
      lastError = error

      // Log the error details
      log(LogLevel.WARN, "fetchPdfWithRetry", `Attempt ${attempt + 1} failed: ${error.message}`, {
        url,
        isAbortError: error.name === "AbortError",
        isNetworkError: error.message.includes("network"),
      })

      // Don't retry if we've reached max retries
      if (attempt >= maxRetries) break

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2 // Double the delay for next attempt
    }
  }

  log(LogLevel.ERROR, "fetchPdfWithRetry", `All ${maxRetries + 1} attempts failed`, { lastError })
  return null
}

export async function sendPurchaseOrderConfirmation({
  supabase,
  orderId,
  contactIds = [],
  employeeIds = [],
  includePrimaryContact = false,
  customMessage,
  subject,
}: SendPurchaseOrderConfirmationProps) {
  log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Starting email send for order ID: ${orderId}`)

  try {
    // Get the resend client - we'll check if it's available but use the sendEmail function instead
    const resendClient = getResendClient()
    if (!resendClient) {
      log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Resend client is not initialized")
      return { success: false, error: "Email service is not configured" }
    }

    // Fetch app settings to get the email sender name
    const { data: appSettings, error: appSettingsError } = await supabase
      .from("app_settings")
      .select("email_sender")
      .single()

    if (appSettingsError) {
      log(LogLevel.WARN, "sendPurchaseOrderConfirmation", "Error fetching app settings", appSettingsError)
      // Continue with default sender name if settings can't be fetched
    }

    // Get the sender name from app settings or use default
    const senderName = appSettings?.email_sender || "Trade Supply Manager"
    log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Using sender name from app_settings: ${senderName}`)

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .select(
        `
        id,
        order_name,
        manufacturer_id,
        status,
        payment_status,
        delivery_method,
        delivery_date,
        delivery_time,
        delivery_address,
        delivery_instructions,
        notes,
        subtotal_order_value,
        total_order_value,
        amount_paid,
        manufacturers (
          id,
          manufacturer_name,
          email
        )
      `,
      )
      .eq("id", orderId)
      .single()

    if (orderError) {
      log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Error fetching order", orderError)
      return { success: false, error: "Error fetching order details" }
    }

    if (!order) {
      log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Order not found")
      return { success: false, error: "Order not found" }
    }

    log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Order fetched successfully: ${order.order_name}`)

    // Fetch order items
    const { data: orderItems, error: orderItemsError } = await supabase
      .from("purchase_order_items")
      .select(
        `
        product_id,
        variant_id,
        quantity,
        unit_price,
        discount_percentage,
        total_order_item_value,
        is_pallet,
        pallets,
        layers,
        products (
          product_name,
          unit
        ),
        product_variants (
          product_variant_name,
          product_variant_sku
        )
      `,
      )
      .eq("purchase_order_id", orderId)
      .eq("is_archived", false)

    if (orderItemsError) {
      log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Error fetching order items", orderItemsError)
      return { success: false, error: "Error fetching order items" }
    }

    log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Fetched ${orderItems.length} order items`)

    // Fetch contacts to email
    let contactEmails: { email: string; name: string; contactId?: string }[] = []

    // Add primary contact from the manufacturer if requested
    if (includePrimaryContact && order.manufacturers.email) {
      if (isValidEmail(order.manufacturers.email)) {
        contactEmails.push({
          name: order.manufacturers.manufacturer_name,
          email: order.manufacturers.email,
        })
        log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Added manufacturer email: ${order.manufacturers.email}`)
      } else {
        log(LogLevel.WARN, "sendPurchaseOrderConfirmation", `Invalid manufacturer email: ${order.manufacturers.email}`)
      }
    }

    // Add selected contacts
    if (contactIds && contactIds.length > 0) {
      // Using first_name and last_name instead of contact_name
      const { data: contacts, error: contactsError } = await supabase
        .from("manufacturer_contacts")
        .select("id, first_name, last_name, email")
        .in("id", contactIds)
        .eq("is_archived", false)

      if (contactsError) {
        log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Error fetching contacts", contactsError)
        return { success: false, error: "Error fetching contact details" }
      }

      if (contacts && contacts.length > 0) {
        const validContacts = contacts
          .filter((contact) => contact.email && isValidEmail(contact.email))
          .map((contact) => ({
            name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Contact",
            email: contact.email!,
            contactId: contact.id,
          }))

        contactEmails = contactEmails.concat(validContacts)

        log(
          LogLevel.INFO,
          "sendPurchaseOrderConfirmation",
          `Added ${validContacts.length} valid contact emails out of ${contacts.length} contacts`,
        )

        if (validContacts.length < contacts.length) {
          log(
            LogLevel.WARN,
            "sendPurchaseOrderConfirmation",
            `Skipped ${contacts.length - validContacts.length} contacts with invalid emails`,
          )
        }
      }
    }

    // If no contacts to email, return error
    if (contactEmails.length === 0) {
      log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "No valid contacts to email")
      return { success: false, error: "No valid email recipients found" }
    }

    // Fetch CC employees
    let ccEmails: string[] = []
    let employeeData: { id: string; name: string; email: string }[] = []

    if (employeeIds && employeeIds.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from("employees")
        .select("id, employee_name, email")
        .in("id", employeeIds)
        .eq("is_active", true)

      if (employeesError) {
        log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Error fetching employees", employeesError)
        return { success: false, error: "Error fetching employee details" }
      }

      if (employees && employees.length > 0) {
        // Filter for valid emails
        const validEmployees = employees.filter((emp) => emp.email && isValidEmail(emp.email))

        ccEmails = validEmployees.map((emp) => emp.email!)

        employeeData = validEmployees.map((emp) => ({
          id: emp.id,
          name: emp.employee_name || "",
          email: emp.email!,
        }))

        log(
          LogLevel.INFO,
          "sendPurchaseOrderConfirmation",
          `Added ${ccEmails.length} valid CC emails out of ${employees.length} employees`,
        )

        if (validEmployees.length < employees.length) {
          log(
            LogLevel.WARN,
            "sendPurchaseOrderConfirmation",
            `Skipped ${employees.length - validEmployees.length} employees with invalid emails`,
          )
        }
      }
    }

    // Generate PDF for attachment - improved error handling and URL construction
    log(LogLevel.INFO, "sendPurchaseOrderConfirmation", "Generating PDF for attachment")
    let pdfBuffer: Buffer | null = null
    try {
      // Construct a proper URL for the PDF endpoint
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ""

      // Determine if we should use absolute or relative URL
      let pdfUrl: string
      if (baseUrl) {
        // Use normalized URL to prevent double slashes
        pdfUrl = normalizeUrl(baseUrl, `/api/purchase-orders/${orderId}/pdf`)
        log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Using absolute URL: ${pdfUrl}`)
      } else {
        // If no base URL is available, try to construct one from the request origin
        // This is a fallback that might help in some deployment environments
        const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
        if (origin) {
          pdfUrl = normalizeUrl(origin, `/api/purchase-orders/${orderId}/pdf`)
          log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Using Vercel URL: ${pdfUrl}`)
        } else {
          // Use relative URL as last resort
          pdfUrl = `/api/purchase-orders/${orderId}/pdf`
          log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Using relative URL: ${pdfUrl}`)
        }
      }

      // Add cache-busting parameter to avoid cached redirects
      const cacheBuster = `_cb=${Date.now()}`
      const pdfUrlWithCacheBuster = pdfUrl.includes("?") ? `${pdfUrl}&${cacheBuster}` : `${pdfUrl}?${cacheBuster}`

      // Fetch PDF with retry logic
      const response = await fetchPdfWithRetry(pdfUrlWithCacheBuster)

      if (!response || !response.ok) {
        log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Failed to generate PDF", {
          status: response?.status,
          statusText: response?.statusText || "",
          url: pdfUrl,
        })

        // Try direct server-side PDF generation as fallback
        log(LogLevel.INFO, "sendPurchaseOrderConfirmation", "Attempting direct PDF generation as fallback")

        try {
          // Import the PDF generation function directly
          const { generatePurchaseOrderPdf } = await import("@/lib/pdf/generate-purchase-order-pdf")

          // Fetch settings for PDF generation
          const { data: settings } = await supabase
            .from("app_settings")
            .select("pdf_header_text, pdf_logo_url, storefront_image")
            .limit(1)
            .single()

          // Generate PDF directly
          pdfBuffer = await generatePurchaseOrderPdf({
            order,
            orderItems: orderItems || [],
            settings: settings || undefined,
          })

          log(
            LogLevel.INFO,
            "sendPurchaseOrderConfirmation",
            `PDF generated successfully via direct method, size: ${pdfBuffer.length} bytes`,
          )
        } catch (directError) {
          log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Direct PDF generation also failed", directError)
          // Continue without PDF
        }
      } else {
        // Process successful response
        const arrayBuffer = await response.arrayBuffer()
        pdfBuffer = Buffer.from(arrayBuffer)
        log(
          LogLevel.INFO,
          "sendPurchaseOrderConfirmation",
          `PDF generated successfully, size: ${pdfBuffer.length} bytes`,
        )
      }
    } catch (error) {
      log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Error generating PDF", error)
      // Continue without PDF if generation fails
    }

    // Format items for the email template
    const formattedItems = orderItems.map((item) => ({
      name: `${item.products.product_name} - ${item.product_variants.product_variant_name}`,
      sku: item.product_variants.product_variant_sku,
      quantity: item.quantity,
      unit: item.products.unit || "Each",
      price: item.unit_price,
      total: item.total_order_item_value,
    }))

    // Create email subject
    const emailSubject = subject || `Purchase Order: ${order.order_name}`

    // Prepare attachments
    const attachments = []
    if (pdfBuffer) {
      attachments.push({
        filename: `${order.order_name.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`,
        content: pdfBuffer,
      })
    } else {
      log(LogLevel.WARN, "sendPurchaseOrderConfirmation", "No PDF attachment will be included in the email")
    }

    // Get default employee for logging if needed
    const { data: defaultEmployee } = await supabase
      .from("employees")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single()

    const defaultEmployeeId = defaultEmployee?.id || null

    // Send email to each contact individually
    const emailResults = await Promise.all(
      contactEmails.map(async (contact) => {
        try {
          // Double-check email validity
          if (!isValidEmail(contact.email)) {
            log(LogLevel.WARN, "sendPurchaseOrderConfirmation", `Skipping invalid email: ${contact.email}`)

            // Log the failure
            await logCommunication(supabase, {
              manufacturerId: order.manufacturer_id,
              purchaseOrderId: orderId,
              contactId: contact.contactId,
              employeeId: employeeData[0]?.id || defaultEmployeeId,
              subject: emailSubject,
              message: "Failed to send purchase order confirmation email - Invalid email format",
              status: "Failed",
              emailAddress: contact.email,
              errorMessage: "Invalid email format",
            })

            return { success: false, email: contact.email, error: "Invalid email format" }
          }

          // Generate email content
          const { html, text } = purchaseOrderConfirmationTemplate({
            orderName: order.order_name,
            manufacturerName: order.manufacturers.manufacturer_name,
            items: formattedItems,
            subtotal: order.subtotal_order_value,
            total: order.total_order_value,
            deliveryMethod: order.delivery_method,
            deliveryDate: new Date(order.delivery_date),
            deliveryTime: order.delivery_time,
            deliveryAddress: order.delivery_address,
            deliveryInstructions: order.delivery_instructions,
            notes: order.notes,
            customMessage: customMessage || "",
            recipientName: contact.name,
            senderName: senderName,
            hasPdfAttachment: !!pdfBuffer,
          })

          log(LogLevel.INFO, "sendPurchaseOrderConfirmation", `Sending email to ${contact.email}`)

          // Use the sendEmail function instead of directly calling resend.sendEmail
          const emailResult = await sendEmail({
            to: contact.email,
            subject: emailSubject,
            html,
            text,
            senderName: senderName,
            cc: ccEmails,
            emailType: "purchase_order_confirmation" as EmailType,
            attachments,
          })

          if (!emailResult.success) {
            throw new Error(emailResult.error || "Failed to send email")
          }

          // Log successful email sending
          log(
            LogLevel.INFO,
            "sendPurchaseOrderConfirmation",
            `Email sent successfully to ${contact.email}`,
            emailResult,
          )

          // Log to database
          await logCommunication(supabase, {
            manufacturerId: order.manufacturer_id,
            purchaseOrderId: orderId,
            contactId: contact.contactId,
            employeeId: employeeData[0]?.id || defaultEmployeeId,
            subject: emailSubject,
            message: customMessage || "Purchase order confirmation email sent",
            status: "Sent",
            emailAddress: contact.email,
          })

          return { success: true, email: contact.email }
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", `Error sending email to ${contact.email}`, error)

          // Log failed email to database
          try {
            await logCommunication(supabase, {
              manufacturerId: order.manufacturer_id,
              purchaseOrderId: orderId,
              contactId: contact.contactId,
              employeeId: employeeData[0]?.id || defaultEmployeeId,
              subject: emailSubject,
              message: "Failed to send purchase order confirmation email",
              status: "Failed",
              emailAddress: contact.email,
              errorMessage,
            })
          } catch (logError) {
            log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Failed to log email error to database", logError)
          }

          return { success: false, email: contact.email, error: errorMessage }
        }
      }),
    )

    // Summarize results
    const successfulEmails = emailResults.filter((result) => result.success)
    const failedEmails = emailResults.filter((result) => !result.success)

    log(
      LogLevel.INFO,
      "sendPurchaseOrderConfirmation",
      `Email sending complete. Success: ${successfulEmails.length}, Failed: ${failedEmails.length}`,
    )

    // Return success if at least one email was sent successfully
    if (successfulEmails.length > 0) {
      return {
        success: true,
        successCount: successfulEmails.length,
        failCount: failedEmails.length,
        successfulRecipients: successfulEmails.map((r) => r.email),
        failedRecipients: failedEmails.map((r) => r.email),
        pdfGenerated: !!pdfBuffer,
      }
    } else if (failedEmails.length > 0) {
      return {
        success: false,
        error: `Failed to send emails to all recipients`,
        failedRecipients: failedEmails.map((r) => ({ email: r.email, error: r.error })),
      }
    } else {
      return { success: false, error: "No emails were sent" }
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log(LogLevel.ERROR, "sendPurchaseOrderConfirmation", "Unexpected error", error)
    return {
      success: false,
      error: errorMessage || "An unexpected error occurred",
      details: error instanceof Error ? { stack: error.stack } : error,
    }
  }
}

// Helper function to log communication
async function logCommunication(
  supabase: SupabaseClient<Database>,
  {
    manufacturerId,
    purchaseOrderId,
    contactId,
    employeeId,
    subject,
    message,
    status,
    emailAddress,
    errorMessage,
  }: {
    manufacturerId: string
    purchaseOrderId: string
    contactId?: string
    employeeId: string | null
    subject: string
    message: string
    status: "Sent" | "Failed"
    emailAddress: string
    errorMessage?: string
  },
) {
  try {
    await supabase.from("manufacturer_communication_logs").insert({
      manufacturer_id: manufacturerId,
      purchase_order_id: purchaseOrderId,
      contact_id: contactId || null,
      employee_id: employeeId,
      communication_type: "Email",
      communication_method: "Email",
      subject,
      message,
      date_created: new Date().toISOString(),
      status,
      email_address: emailAddress,
      error_message: errorMessage,
    })

    log(LogLevel.INFO, "logCommunication", `Logged ${status} email to ${emailAddress}`)
    return true
  } catch (error) {
    log(LogLevel.ERROR, "logCommunication", `Failed to log communication to database`, error)
    return false
  }
}
