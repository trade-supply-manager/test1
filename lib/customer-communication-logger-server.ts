import { getSupabaseServer } from "@/lib/supabase-server"
import type { CommunicationLogEntry } from "@/lib/customer-communication-logger"

export class ServerCustomerCommunicationLogger {
  /**
   * Check if a string is a valid UUID
   * This helps prevent errors when passing non-UUID strings to Supabase
   */
  private static isValidUuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  }

  /**
   * Log a customer communication from server components
   */
  static async logCommunication(entry: CommunicationLogEntry): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate UUIDs before sending to database
      if (entry.customer_id && !this.isValidUuid(entry.customer_id)) {
        console.warn(`Invalid customer_id format: ${entry.customer_id}. Skipping log entry.`)
        return { success: false, error: "Invalid customer ID format" }
      }

      if (entry.order_id && !this.isValidUuid(entry.order_id)) {
        console.warn(`Invalid order_id format: ${entry.order_id}. Removing from log entry.`)
        entry = { ...entry, order_id: undefined }
      }

      // Use the server-side Supabase client
      const supabase = getSupabaseServer()

      // Create log entry object without the content field
      const logEntry = {
        customer_id: entry.customer_id,
        order_id: entry.order_id,
        email_address: entry.email_address,
        subject: entry.subject,
        // Explicitly include content field if provided
        ...(entry.content && { content: entry.content }),
        communication_method: entry.communication_method,
        status: entry.status,
        error_message: entry.error_message,
        date_created: new Date().toISOString(),
      }

      // Insert directly into customer_email_logs table
      const { error } = await supabase.from("customer_email_logs").insert(logEntry)

      if (error) {
        console.error("Error logging customer communication:", error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error("Error in ServerCustomerCommunicationLogger.logCommunication:", error)
      return { success: false, error: error.message || "An unexpected error occurred" }
    }
  }

  /**
   * Get communication logs for a specific customer from server components
   */
  static async getCustomerLogs(customerId: string): Promise<any[]> {
    try {
      if (!this.isValidUuid(customerId)) {
        console.warn(`Invalid customer_id format: ${customerId}. Returning empty logs.`)
        return []
      }

      // Use the server-side Supabase client
      const supabase = getSupabaseServer()

      const { data, error } = await supabase
        .from("customer_email_logs")
        .select("*")
        .eq("customer_id", customerId)
        .order("date_created", { ascending: false })

      if (error) {
        console.error("Error fetching customer communication logs:", error)
        return []
      }

      return data || []
    } catch (error) {
      console.error("Error in ServerCustomerCommunicationLogger.getCustomerLogs:", error)
      return []
    }
  }

  /**
   * Get communication logs for a specific order from server components
   */
  static async getOrderLogs(orderId: string): Promise<any[]> {
    try {
      if (!this.isValidUuid(orderId)) {
        console.warn(`Invalid order_id format: ${orderId}. Returning empty logs.`)
        return []
      }

      // Use the server-side Supabase client
      const supabase = getSupabaseServer()

      const { data, error } = await supabase
        .from("customer_email_logs")
        .select("*")
        .eq("order_id", orderId)
        .order("date_created", { ascending: false })

      if (error) {
        console.error("Error fetching order communication logs:", error)
        return []
      }

      return data || []
    } catch (error) {
      console.error("Error in ServerCustomerCommunicationLogger.getOrderLogs:", error)
      return []
    }
  }
}
