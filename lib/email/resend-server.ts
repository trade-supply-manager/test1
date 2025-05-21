import { Resend } from "resend"

// Create a singleton instance of the Resend client
let resendInstance: Resend | null = null

export function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set")
    }
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

// Reset the instance (mainly for testing)
export function resetResendClient(): void {
  resendInstance = null
}

// Add the missing serverSendEmail function
export async function serverSendEmail({
  to,
  from,
  subject,
  html,
  text,
  cc,
  bcc,
  attachments,
  tags,
}: {
  to: string | string[]
  from: string
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: Array<{
    filename: string
    content: Buffer
  }>
  tags?: Array<{
    name: string
    value: string
  }>
}) {
  try {
    const resend = getResendClient()

    // Validate required fields
    if (!to || !from || !subject || (!html && !text)) {
      throw new Error("Missing required email fields (to, from, subject, and either html or text)")
    }

    // Format recipients as arrays if they're strings
    const toArray = Array.isArray(to) ? to : [to]
    const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined

    // Send the email
    const result = await resend.emails.send({
      from,
      to: toArray,
      subject,
      html,
      text,
      cc: ccArray,
      bcc: bccArray,
      attachments,
      tags,
    })

    return result
  } catch (error) {
    console.error("Error sending email via Resend:", error)
    throw error
  }
}
