import { getResendClient, type EmailType } from "./resend-client"
import { emailDebug } from "../debug-email-utils"

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text: string
  senderName?: string
  cc?: string[]
  emailType: EmailType
  attachments?: Array<{
    filename: string
    content: Buffer
  }>
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  senderName,
  cc,
  emailType,
  attachments,
}: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  // Convert 'to' to array format for consistent handling
  const toArray = Array.isArray(to) ? to : [to]

  emailDebug.event("SEND_EMAIL", "sendEmail function called", {
    to: toArray,
    toCount: toArray.length,
    subject,
    hasHtml: !!html,
    hasText: !!text,
    senderName,
    ccCount: cc?.length || 0,
    emailType,
    attachmentsCount: attachments?.length || 0,
  })

  try {
    // Check environment variables
    const envCheck = emailDebug.env(["RESEND_API_KEY"])
    if (envCheck.missing.length > 0) {
      emailDebug.error("SEND_EMAIL", "Missing required environment variables", { missing: envCheck.missing })
      return {
        success: false,
        error: "Email service is not configured (missing API key)",
      }
    }

    const resend = getResendClient()
    if (!resend) {
      emailDebug.error("SEND_EMAIL", "Failed to initialize Resend client")
      return { success: false, error: "Email service is not configured properly" }
    }

    // Validate email addresses
    if (toArray.length === 0) {
      emailDebug.error("SEND_EMAIL", "No recipient email addresses provided")
      return { success: false, error: "No recipient email addresses provided" }
    }

    // Validate each recipient email
    const invalidRecipients = toArray.filter((email) => !email || !email.includes("@"))
    if (invalidRecipients.length > 0) {
      emailDebug.error("SEND_EMAIL", "Invalid recipient email addresses", { invalidRecipients })

      // If all recipients are invalid, return error
      if (invalidRecipients.length === toArray.length) {
        return { success: false, error: "All recipient email addresses are invalid" }
      }

      // Otherwise, filter out invalid emails
      const validTo = toArray.filter((email) => email && email.includes("@"))
    }

    // Validate CC addresses if provided
    let validCc = cc
    if (cc && cc.length > 0) {
      const invalidCc = cc.filter((email) => !email || !email.includes("@"))
      if (invalidCc.length > 0) {
        emailDebug.warning("SEND_EMAIL", "Invalid CC email addresses", { invalidCc })
        // Filter out invalid emails
        validCc = cc.filter((email) => email && email.includes("@"))
      }
    }

    // Prepare from address with sender name if provided
    const from = senderName
      ? `${senderName} <noreply@tradesupplymanager.com>`
      : "Trade Supply Manager <noreply@tradesupplymanager.com>"

    emailDebug.event("SEND_EMAIL", "Sending email via Resend", {
      from,
      to: toArray,
      subject,
      ccCount: validCc?.length || 0,
      attachmentsCount: attachments?.length || 0,
    })

    // Send email
    const { data, error } = await resend.emails.send({
      from,
      to: toArray,
      subject,
      html,
      text,
      cc: validCc,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
    })

    if (error) {
      emailDebug.error("SEND_EMAIL", "Resend API error", { error, errorMessage: error.message })
      return { success: false, error: error.message }
    }

    const validTo = toArray.filter((email) => email && email.includes("@"))

    emailDebug.event("SEND_EMAIL", "Email sent successfully", {
      messageId: data?.id,
      recipients: validTo,
      cc: validCc,
    })
    return { success: true }
  } catch (error: any) {
    emailDebug.error("SEND_EMAIL", "Unexpected error", {
      error,
      errorMessage: error.message,
      errorStack: error.stack,
    })
    return {
      success: false,
      error: error.message || "An unexpected error occurred while sending email",
    }
  }
}
