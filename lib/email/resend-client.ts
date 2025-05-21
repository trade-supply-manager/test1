import { Resend } from "resend"
import { log, LogLevel } from "@/lib/debug-utils" // Correct import

// Define the email types for better type safety
export type EmailType = "order_confirmation" | "purchase_order_confirmation" | "test_email" | "general"

// Define the interface for the sendEmail method
interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  cc?: string[]
  bcc?: string[]
  attachments?: Array<{
    filename: string
    content: Buffer
  }>
  senderName?: string
  emailType?: EmailType
}

// Create a singleton instance of the Resend client
let resendInstance: Resend | null = null

// Function to get the Resend client instance
export function getResendClient() {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      log(LogLevel.WARN, "ResendClient", "RESEND_API_KEY is not defined")
      return null
    }

    try {
      resendInstance = new Resend(apiKey)
      log(LogLevel.INFO, "ResendClient", "Resend client initialized")
    } catch (error) {
      // Fixed: Use the correct logging function
      log(LogLevel.ERROR, "ResendClient", "Failed to initialize Resend client", error)
      return null
    }
  }

  return resendInstance
}

// Reset the instance (mainly for testing)
export function resetResendClient(): void {
  resendInstance = null
}

// Add the missing sendEmail function
export async function sendEmail({
  to,
  subject,
  html,
  text,
  cc,
  bcc,
  attachments,
  senderName,
  emailType = "general",
}: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // Check environment variables
    if (!process.env.RESEND_API_KEY) {
      log(LogLevel.ERROR, "sendEmail", "RESEND_API_KEY is not defined")
      return { success: false, error: "Email service is not configured" }
    }

    const resend = getResendClient()
    if (!resend) {
      log(LogLevel.ERROR, "sendEmail", "Failed to initialize Resend client")
      return { success: false, error: "Email service is not configured properly" }
    }

    // Use the provided senderName or default to "Trade Supply Manager"
    const fromName = senderName || "Trade Supply Manager"
    const fromEmail = "noreply@tradesupplymanager.com"

    // Send email
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
      text,
      cc,
      bcc,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
      tags: [
        {
          name: "email_type",
          value: emailType,
        },
      ],
    })

    if (error) {
      log(LogLevel.ERROR, "sendEmail", "Resend API error", { error, errorMessage: error.message })
      return { success: false, error: error.message }
    }

    log(LogLevel.INFO, "sendEmail", "Email sent successfully", { messageId: data?.id })
    return { success: true }
  } catch (error: any) {
    log(LogLevel.ERROR, "sendEmail", "Unexpected error", {
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
