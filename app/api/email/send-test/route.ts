import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/resend-client"

export async function POST(request: Request) {
  try {
    const { to } = await request.json()

    if (!to || typeof to !== "string") {
      return NextResponse.json({ success: false, error: "Valid recipient email address is required" }, { status: 400 })
    }

    const { success, error } = await sendEmail({
      to,
      subject: "Test Email from Trade Supply Manager",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4f46e5;">Test Email</h1>
          <p>This is a test email from Trade Supply Manager.</p>
          <p>If you're receiving this email, your email configuration is working correctly!</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <p>Sent from Ritchies Feed and Seed</p>
          </div>
        </div>
      `,
      text: "This is a test email from Trade Supply Manager. If you're receiving this email, your email configuration is working correctly!",
      emailType: "test_email",
    })

    if (!success) {
      return NextResponse.json({ success: false, error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error sending test email:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to send test email" }, { status: 500 })
  }
}
