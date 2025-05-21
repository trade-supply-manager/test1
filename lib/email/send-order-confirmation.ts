import { getResendClient } from "./resend-server"
import { orderConfirmationTemplate } from "./templates/order-confirmation"
import { log, LogLevel, debugEmailState, debugEmailSending, debugEmailResult } from "@/lib/debug-email-utils"
import { getSupabaseServer } from "@/lib/supabase-server"
import { formatDate } from "@/lib/utils"
import { CustomerCommunicationLogger } from "@/lib/customer-communication-logger"
import { generateOrderPdf } from "@/lib/pdf/generate-order-pdf"

// Add this at the top of the file
function isValidUUID(id: any): boolean {
  if (typeof id !== "string") {
    return false
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// Maximum size for attachments (10MB)
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

// Then in the sendOrderConfirmation function, add validation for order.id
export async function sendOrderConfirmation(
  order: any,
  selectedContactIds: string[] = [],
  selectedEmployeeIds: string[] = [],
  includePrimaryContact = true,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate order object
    if (!order || typeof order !== "object") {
      const errorMsg = `Invalid order parameter: ${typeof order}`
      log(LogLevel.ERROR, "sendOrderConfirmation", errorMsg)
      return { success: false, error: errorMsg }
    }

    // Validate order.id
    if (!order.id || !isValidUUID(order.id)) {
      const errorMsg = `Invalid order.id: ${order.id}`
      log(LogLevel.ERROR, "sendOrderConfirmation", errorMsg)
      return { success: false, error: errorMsg }
    }

    // Validate order.customer_id
    if (!order.customer_id || !isValidUUID(order.customer_id)) {
      const errorMsg = `Invalid order.customer_id: ${order.customer_id}`
      log(LogLevel.ERROR, "sendOrderConfirmation", errorMsg)
      return { success: false, error: errorMsg }
    }

    log(LogLevel.INFO, "sendOrderConfirmationEmail", "Starting email sending process", {
      orderId: order.id,
      contactIdsCount: selectedContactIds.length,
      employeeIdsCount: selectedEmployeeIds.length,
      includePrimaryContact,
    })

    // Debug the input parameters
    debugEmailState(order.id, selectedContactIds, selectedEmployeeIds, includePrimaryContact, "")

    // Get Supabase and Resend clients
    const supabase = getSupabaseServer()
    const resend = getResendClient()

    // Check if Resend client is available
    if (!resend) {
      const errorMsg = "Email service is not configured - Resend client is null"
      log(LogLevel.ERROR, "sendOrderConfirmationEmail", errorMsg)
      console.error(`❌ ${errorMsg}`)
      return { success: false, error: errorMsg }
    }

    // Fetch app settings to get the email sender name
    const { data: appSettings, error: appSettingsError } = await supabase
      .from("app_settings")
      .select("email_sender")
      .single()

    if (appSettingsError) {
      log(LogLevel.WARN, "sendOrderConfirmationEmail", "Error fetching app settings", {
        error: appSettingsError,
        message: appSettingsError.message,
      })
      // Continue with default sender name if settings can't be fetched
    }

    // Get the sender name from app settings or use default
    const senderName = appSettings?.email_sender || "Trade Supply Manager"
    log(LogLevel.INFO, "sendOrderConfirmationEmail", `Using sender name from app_settings: ${senderName}`)

    // Fetch order details with customer information
    log(LogLevel.INFO, "sendOrderConfirmationEmail", `Fetching order details for ID: ${order.id}`)
    const { data: fullOrder, error: orderError } = await supabase
      .from("customer_orders")
      .select(
        `
        id,
        order_name,
        customer_id,
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
        tax_rate,
        amount_paid,
        date_created,
        customers (
          id,
          customer_name,
          email,
          phone_number,
          address
        )
      `,
      )
      .eq("id", order.id)
      .single()

    if (orderError) {
      log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Error fetching order", {
        error: orderError,
        message: orderError.message,
        details: orderError.details,
      })
      return { success: false, error: "Error fetching order details: " + orderError.message }
    }

    if (!fullOrder) {
      log(LogLevel.ERROR, "sendOrderConfirmationEmail", `Order not found: ${order.id}`)
      return { success: false, error: "Order not found" }
    }

    log(LogLevel.INFO, "sendOrderConfirmationEmail", "Order found", {
      id: fullOrder.id,
      name: fullOrder.order_name,
      customerId: fullOrder.customer_id,
    })

    // Verify customer data is present
    if (!fullOrder.customers) {
      log(LogLevel.ERROR, "sendOrderConfirmationEmail", `Customer data missing in order: ${order.id}`)
      return { success: false, error: "Customer data missing in order" }
    }

    log(LogLevel.INFO, "sendOrderConfirmationEmail", "Customer data", {
      id: fullOrder.customers.id,
      name: fullOrder.customers.customer_name,
      email: fullOrder.customers.email || "No email",
      hasEmail: !!fullOrder.customers.email,
    })

    // Fetch company settings for logo
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("storefront_image, company_name")
      .single()

    if (settingsError) {
      log(LogLevel.WARN, "sendOrderConfirmationEmail", "Error fetching company settings", {
        error: settingsError,
        message: settingsError.message,
      })
      // Continue without settings
    }

    // Fetch order items
    const { data: orderItems, error: orderItemsError } = await supabase
      .from("customer_order_items")
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
      .eq("customer_order_id", order.id)
      .eq("is_archived", false)

    if (orderItemsError) {
      log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Error fetching order items", {
        error: orderItemsError,
        message: orderItemsError.message,
      })
      return { success: false, error: "Error fetching order items: " + orderItemsError.message }
    }

    log(LogLevel.INFO, "sendOrderConfirmationEmail", `Found ${orderItems?.length || 0} order items`)

    // Initialize recipient arrays
    const toEmails: string[] = []
    const ccEmails: string[] = []
    const recipientNames: Record<string, string> = {}

    // Add primary contact from the customer if requested
    if (includePrimaryContact && fullOrder.customers.email) {
      log(LogLevel.INFO, "sendOrderConfirmationEmail", `Adding primary customer email: ${fullOrder.customers.email}`)
      toEmails.push(fullOrder.customers.email)
      recipientNames[fullOrder.customers.email] = fullOrder.customers.customer_name || "Customer"
    } else if (includePrimaryContact) {
      log(
        LogLevel.WARN,
        "sendOrderConfirmationEmail",
        "Primary contact inclusion requested but customer has no email",
        {
          customerId: fullOrder.customers.id,
          customerName: fullOrder.customers.customer_name,
        },
      )
    }

    // Add selected contacts
    if (selectedContactIds && selectedContactIds.length > 0) {
      log(LogLevel.INFO, "sendOrderConfirmationEmail", "Fetching selected contacts", { contactIds: selectedContactIds })

      // Verify contactIds are valid UUIDs to prevent SQL injection
      const validContactIds = selectedContactIds.filter((id) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        return uuidRegex.test(id)
      })

      if (validContactIds.length !== selectedContactIds.length) {
        log(LogLevel.WARN, "sendOrderConfirmationEmail", "Some contact IDs were invalid and filtered out", {
          original: selectedContactIds,
          filtered: validContactIds,
        })
      }

      if (validContactIds.length === 0) {
        log(LogLevel.WARN, "sendOrderConfirmationEmail", "No valid contact IDs provided")
      } else {
        const { data: contacts, error: contactsError } = await supabase
          .from("customer_contacts")
          .select("id, first_name, last_name, email")
          .in("id", validContactIds)
          .eq("is_archived", false)

        if (contactsError) {
          log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Error fetching contacts", {
            error: contactsError,
            message: contactsError.message,
          })
        } else if (contacts && contacts.length > 0) {
          log(LogLevel.INFO, "sendOrderConfirmationEmail", `Found ${contacts.length} contacts`)

          // Filter contacts with valid emails
          const validContacts = contacts.filter((contact) => contact.email && contact.email.includes("@"))
          log(LogLevel.INFO, "sendOrderConfirmationEmail", `Found ${validContacts.length} contacts with valid emails`, {
            validContacts: validContacts.map((c) => ({ id: c.id, email: c.email })),
          })

          // Add to recipients
          validContacts.forEach((contact) => {
            toEmails.push(contact.email)
            recipientNames[contact.email] = `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Contact"
          })
        } else {
          log(LogLevel.WARN, "sendOrderConfirmationEmail", "No contacts found for the provided IDs", {
            contactIds: validContactIds,
            customerId: fullOrder.customers.id,
          })
        }
      }
    }

    // Fetch CC employees
    if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
      log(LogLevel.INFO, "sendOrderConfirmationEmail", "Fetching selected employees", {
        employeeIds: selectedEmployeeIds,
      })

      // Verify employeeIds are valid UUIDs
      const validEmployeeIds = selectedEmployeeIds.filter((id) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        return uuidRegex.test(id)
      })

      if (validEmployeeIds.length !== selectedEmployeeIds.length) {
        log(LogLevel.WARN, "sendOrderConfirmationEmail", "Some employee IDs were invalid and filtered out", {
          original: selectedEmployeeIds,
          filtered: validEmployeeIds,
        })
      }

      if (validEmployeeIds.length === 0) {
        log(LogLevel.WARN, "sendOrderConfirmationEmail", "No valid employee IDs provided")
      } else {
        const { data: employees, error: employeesError } = await supabase
          .from("employees")
          .select("id, employee_name, email")
          .in("id", validEmployeeIds)
          .eq("is_active", true)

        if (employeesError) {
          log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Error fetching employees", {
            error: employeesError,
            message: employeesError.message,
          })
        } else if (employees && employees.length > 0) {
          log(LogLevel.INFO, "sendOrderConfirmationEmail", `Found ${employees.length} employees`)

          // Filter employees with valid emails
          const validEmployees = employees.filter((emp) => emp.email && emp.email.includes("@"))
          log(
            LogLevel.INFO,
            "sendOrderConfirmationEmail",
            `Found ${validEmployees.length} employees with valid emails`,
            {
              validEmployees: validEmployees.map((e) => ({ id: e.id, email: e.email })),
            },
          )

          // Add to CC list
          validEmployees.forEach((emp) => {
            ccEmails.push(emp.email)
          })
        } else {
          log(LogLevel.WARN, "sendOrderConfirmationEmail", "No employees found for the provided IDs", {
            employeeIds: validEmployeeIds,
          })
        }
      }
    }

    // If no primary recipients but we have employees, use the first employee as a primary recipient
    if (toEmails.length === 0 && ccEmails.length > 0) {
      log(
        LogLevel.INFO,
        "sendOrderConfirmationEmail",
        "No primary recipients found, using first employee as primary recipient",
      )
      const firstEmployeeEmail = ccEmails.shift()
      if (firstEmployeeEmail) {
        toEmails.push(firstEmployeeEmail)
      }
    }

    // Check if we have any recipients
    if (toEmails.length === 0 && ccEmails.length === 0) {
      const errorMsg =
        "No valid email recipients found. Please ensure the customer has an email address or select contacts with valid emails."
      log(LogLevel.ERROR, "sendOrderConfirmationEmail", errorMsg, {
        includePrimaryContact,
        customerHasEmail: !!fullOrder.customers.email,
        contactIdsCount: selectedContactIds.length,
        employeeIdsCount: selectedEmployeeIds.length,
      })
      return { success: false, error: errorMsg }
    }

    log(
      LogLevel.INFO,
      "sendOrderConfirmationEmail",
      `Final recipient count: ${toEmails.length} primary recipients, ${ccEmails.length} CCs`,
    )
    log(LogLevel.INFO, "sendOrderConfirmationEmail", "Primary Recipients", toEmails)
    log(LogLevel.INFO, "sendOrderConfirmationEmail", "CC Recipients", ccEmails)

    // Format items for the email template
    const formattedItems = orderItems.map((item) => ({
      name: `${item.products?.product_name || ""} ${
        item.product_variants?.product_variant_name ? `- ${item.product_variants.product_variant_name}` : ""
      }`,
      sku: item.product_variants?.product_variant_sku || "",
      quantity: item.quantity,
      unit: item.products?.unit || "Each",
      unitPrice: item.unit_price,
      total: item.total_order_item_value,
    }))

    // Calculate tax amount
    const subtotal = fullOrder.subtotal_order_value || 0
    const total = fullOrder.total_order_value || 0
    const tax = total - subtotal

    // Prepare data for the email template
    const emailTemplateData = {
      orderNumber: fullOrder.order_name,
      orderDate: formatDate(fullOrder.date_created),
      deliveryDate: formatDate(fullOrder.delivery_date),
      deliveryTime: fullOrder.delivery_time || "N/A",
      customerName: fullOrder.customers.customer_name,
      customerEmail: fullOrder.customers.email || "",
      customerPhone: fullOrder.customers.phone_number || "",
      deliveryAddress: fullOrder.delivery_address,
      deliveryInstructions: fullOrder.delivery_instructions,
      subtotal: subtotal,
      tax: tax,
      total: total,
      items: formattedItems,
      headerImageUrl: settings?.storefront_image || null,
    }

    // Generate email content using the template
    const html = orderConfirmationTemplate(emailTemplateData)

    // Generate plain text version
    const text = `
Order Confirmation - ${fullOrder.order_name}

Hello ${fullOrder.customers.customer_name},

We're pleased to confirm your order has been received and is being processed.

Order: ${fullOrder.order_name}
Order Date: ${formatDate(fullOrder.date_created)}

Delivery Information:
Method: ${fullOrder.delivery_address ? "Delivery" : "Pickup"}
Date: ${formatDate(fullOrder.delivery_date)}
Time: ${fullOrder.delivery_time || "N/A"}
${fullOrder.delivery_address ? `Address: ${fullOrder.delivery_address}` : ""}
${fullOrder.delivery_instructions ? `Instructions: ${fullOrder.delivery_instructions}` : ""}

Order Summary:
${formattedItems
  .map(
    (item) =>
      `${item.name} (${item.sku}) - ${item.quantity} ${item.unit} x $${item.unitPrice.toFixed(2)} = $${item.total.toFixed(
        2,
      )}`,
  )
  .join("\n")}

Subtotal: $${subtotal.toFixed(2)}
Tax: $${tax.toFixed(2)}
Total: $${total.toFixed(2)}

If you have any questions about your order, please contact us.

A detailed PDF invoice of your order is attached to this email for your records.

© ${new Date().getFullYear()} ${settings?.company_name || senderName}. All rights reserved.
    `

    // Prepare attachments
    const attachments = []

    // DIRECT PDF GENERATION - This is the key change
    try {
      console.log(`📄 Directly generating PDF for order: ${fullOrder.order_name} (${order.id})`)

      // Prepare data for PDF generation
      const pdfData = {
        order: fullOrder,
        orderItems: orderItems,
        settings: {
          storefront_image: settings?.storefront_image || null,
          pdf_header_text: settings?.company_name || senderName,
          pdf_logo_url: settings?.storefront_image || null,
          email_sender: senderName,
        },
      }

      // Generate PDF directly using our function
      const pdfBuffer = await generateOrderPdf(pdfData)

      // Log the buffer size
      console.log(`📄 Generated PDF buffer size: ${pdfBuffer.length} bytes`)

      // Always attach the PDF regardless of size (unless it's empty)
      if (pdfBuffer.length > 0) {
        attachments.push({
          filename: `Order_${fullOrder.order_name}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        })

        console.log(`📄 PDF attachment added: ${pdfBuffer.length} bytes`)
      } else {
        console.error("❌ Generated PDF buffer is empty")
      }
    } catch (pdfError) {
      console.error("❌ Error generating PDF directly:", pdfError)
      log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Error generating PDF directly", {
        error: pdfError,
        message: pdfError instanceof Error ? pdfError.message : String(pdfError),
      })

      // Continue without PDF attachment if generation fails
    }

    // Send email
    try {
      // CRITICAL: Ensure we have at least one valid recipient
      if (toEmails.length === 0) {
        const errorMsg =
          "No valid primary recipients for email. Please ensure at least one recipient has a valid email address."
        log(LogLevel.ERROR, "sendOrderConfirmationEmail", errorMsg)
        return { success: false, error: errorMsg }
      }

      log(LogLevel.INFO, "sendOrderConfirmationEmail", `Sending email to ${toEmails.join(", ")}`)

      // Prepare email data with dynamic sender name from app_settings
      const emailData = {
        from: `${senderName} <orders@tradesupplymanager.com>`,
        to: toEmails, // Keep as array - Resend API supports arrays for recipients
        subject: `Order Confirmation - ${fullOrder.order_name}`,
        html,
        text,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        attachments,
      }

      // Log the from field for debugging
      log(LogLevel.INFO, "sendOrderConfirmationEmail", "Email 'from' field", {
        from: emailData.from,
        senderName,
      })

      // Debug email sending
      debugEmailSending(toEmails, ccEmails, emailData.subject, attachments.length > 0)

      // Log the exact 'to' field for debugging
      log(LogLevel.INFO, "sendOrderConfirmationEmail", "Email 'to' field", {
        to: emailData.to,
        toType: typeof emailData.to,
        toIsArray: Array.isArray(emailData.to),
        toLength: Array.isArray(emailData.to) ? emailData.to.length : 0,
      })

      // Log detailed email data for debugging
      console.log(
        "📧 [DEBUG] RESEND API PAYLOAD:",
        JSON.stringify(
          {
            sender: {
              from: emailData.from,
              senderName,
            },
            recipients: {
              to: emailData.to,
              cc: emailData.cc,
              recipientCount: Array.isArray(emailData.to) ? emailData.to.length : 1,
              ccCount: Array.isArray(emailData.cc) ? emailData.cc.length : 0,
            },
            emailDetails: {
              subject: emailData.subject,
              hasHtml: !!emailData.html,
              hasText: !!emailData.text,
              htmlLength: emailData.html ? emailData.html.length : 0,
              textLength: emailData.text ? emailData.text.length : 0,
            },
            attachments: {
              count: emailData.attachments ? emailData.attachments.length : 0,
              fileNames: emailData.attachments ? emailData.attachments.map((a) => a.filename) : [],
              fileSizes: emailData.attachments ? emailData.attachments.map((a) => a.content.length) : [],
            },
          },
          null,
          2,
        ),
      )

      // Send the email with detailed error handling
      let emailResult
      let emailError

      try {
        const result = await resend.emails.send(emailData)
        emailResult = result.data
        emailError = result.error
      } catch (err) {
        // Handle unexpected errors from the Resend API
        log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Exception from Resend API", {
          error: err,
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        })

        console.error("❌ Exception from Resend API:", err)

        return {
          success: false,
          error: err instanceof Error ? err.message : "Unexpected error from email service",
        }
      }

      if (emailError) {
        log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Error sending email", {
          error: emailError,
          message: emailError.message,
          statusCode: emailError.statusCode,
        })
        console.error("❌ Resend API returned an error:", emailError)
        debugEmailResult(false, emailError.message)

        // Log to database
        await supabase.from("email_logs").insert({
          customer_id: fullOrder.customer_id,
          order_id: order.id,
          email_address: Array.isArray(toEmails) ? toEmails.join(", ") : toEmails,
          subject: `Order Confirmation - ${fullOrder.order_name}`,
          communication_method: "email",
          success: false,
          error_message: emailError.message,
          date_created: new Date().toISOString(),
        })

        return { success: false, error: emailError.message }
      }

      log(LogLevel.INFO, "sendOrderConfirmationEmail", "Email sent successfully", {
        result: emailResult,
        messageId: emailResult?.id,
        from: emailData.from,
      })
      console.log("✅ Email sent successfully:", emailResult?.id)
      debugEmailResult(true)

      // Collect all recipients
      const allRecipients = [...toEmails.map((email) => ({ email })), ...ccEmails.map((email) => ({ email }))]
      const customer = fullOrder.customers

      // Log the email to customer_email_logs
      try {
        // Log for each recipient
        for (const recipient of allRecipients) {
          await CustomerCommunicationLogger.logCommunication({
            customer_id: customer.id,
            order_id: order.id,
            email_address: recipient.email,
            subject: `Order Confirmation: ${fullOrder.order_name}`,
            communication_method: "email",
            status: "sent",
          })
        }

        log(LogLevel.INFO, "EMAIL", "Email logging completed successfully")
      } catch (loggingError) {
        log(LogLevel.ERROR, "EMAIL", "Error logging email", { error: loggingError })
        // Don't throw the error to avoid interfering with the main flow
      }

      // Return success
      return { success: true }
    } catch (error: any) {
      log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Unexpected error sending email", {
        error,
        message: error.message,
        stack: error.stack,
      })
      console.error("❌ Unexpected error sending email:", error)
      debugEmailResult(false, error.message || "Unknown error")

      // Log to database
      await supabase.from("email_logs").insert({
        customer_id: fullOrder.customer_id,
        order_id: order.id,
        email_address: Array.isArray(toEmails) ? toEmails.join(", ") : toEmails,
        subject: `Order Confirmation - ${fullOrder.order_name}`,
        communication_method: "email",
        success: false,
        error_message: error.message || "Unknown error",
        date_created: new Date().toISOString(),
      })

      return { success: false, error: error.message || "An unexpected error occurred" }
    }
  } catch (error: any) {
    // Error handling remains the same
    log(LogLevel.ERROR, "sendOrderConfirmationEmail", "Unexpected error in function", {
      error,
      message: error.message,
      stack: error.stack,
    })
    console.error("❌ Unexpected error in sendOrderConfirmationEmail function:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
