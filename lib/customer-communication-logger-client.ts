// Client-safe version of the communication logger
// This file should NOT import any server-only modules

import type { Database } from "@/types/supabase"
import { getSupabaseClient } from "@/lib/supabase-client"

export class CustomerCommunicationLoggerClient {
  static async getCustomerLogs(customerId: string) {
    const supabase = getSupabaseClient<Database>()

    // Changed table name from "customer_communication_logs" to "customer_email_logs"
    const { data, error } = await supabase
      .from("customer_email_logs")
      .select("*")
      .eq("customer_id", customerId)
      .order("date_created", { ascending: false })

    if (error) {
      console.error("Error fetching customer logs:", error)
      return []
    }

    return data || []
  }

  static async getOrderLogs(orderId: string) {
    const supabase = getSupabaseClient<Database>()

    // Changed table name from "customer_communication_logs" to "customer_email_logs"
    const { data, error } = await supabase
      .from("customer_email_logs")
      .select("*")
      .eq("order_id", orderId)
      .order("date_created", { ascending: false })

    if (error) {
      console.error("Error fetching order logs:", error)
      return []
    }

    return data || []
  }
}
