import { NextResponse } from "next/server"
import { serverSendEmail } from "@/lib/email/resend-server"

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { to, subject, html, text, senderName, replyTo, cc, bcc, attachments, tags } = data

    // Validate required parameters
    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required email parameters",
        },
        { status: 400 },
      )
    }

    const result = await serverSendEmail({
      to,
      subject,
      html,
      text,
      senderName,
      replyTo,
      cc,
      bcc,
      attachments,
      tags,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        id: result.id,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error sending email:", error)
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || "An error occurred while sending the email",
      },
      { status: 500 },
    )
  }
}
