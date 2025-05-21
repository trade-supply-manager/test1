import { createServerSupabaseClient } from "@/lib/supabase-server"
import { sendPurchaseOrderConfirmation } from "./send-purchase-order-confirmation"
import { log, LogLevel } from "@/lib/debug-utils"

export async function sendPurchaseOrderConfirmationEmail(
  orderId: string,
  contactIds: string[] = [],
  employeeIds: string[] = [],
  includePrimaryContact = false,
  customMessage?: string,
  subject?: string,
) {
  try {
    const supabase = createServerSupabaseClient()

    return await sendPurchaseOrderConfirmation({
      supabase,
      orderId,
      contactIds,
      employeeIds,
      includePrimaryContact,
      customMessage,
      subject,
    })
  } catch (error: any) {
    log(LogLevel.ERROR, "sendPurchaseOrderConfirmationEmail", "Error sending purchase order confirmation email", error)
    return { success: false, error: error.message || "An error occurred while sending the email" }
  }
}
