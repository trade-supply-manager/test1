import { v4 as uuidv4 } from "uuid"
import { getSupabaseClient } from "@/lib/supabase-client"
import { getCurrentTimestamp } from "@/lib/utils"
import { log, LogLevel } from "@/lib/debug-utils" // Check if this is correct

// Let's make sure any logging in this file uses the correct methods
// If there are any instances of debugLog.error, they should be replaced with log(LogLevel.ERROR, ...)

/**
 * Interface for manufacturer email log options
 */
export interface ManufacturerEmailLogOptions {
  manufacturerId: string
  orderId?: string
  emailAddress: string
  subject: string
  communicationMethod: string
  status: "success" | "error"
  errorMessage?: string
  createdByUserId?: string
  message?: string
}

/**
 * Log an email sent to a manufacturer
 * This function logs to the manufacturer_email_logs table
 */
export async function logManufacturerEmail({
  manufacturerId,
  orderId,
  emailAddress,
  subject,
  communicationMethod,
  status,
  errorMessage,
  createdByUserId,
  message,
}: ManufacturerEmailLogOptions) {
  try {
    if (!manufacturerId) {
      log(LogLevel.ERROR, "logManufacturerEmail", "Missing required manufacturerId", { emailAddress, subject })
      return { success: false, error: "Missing required manufacturerId" }
    }

    const supabase = getSupabaseClient()
    const timestamp = getCurrentTimestamp()

    // If no user ID was provided, try to get the current authenticated user
    if (!createdByUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      createdByUserId = user?.id
    }

    const logEntry = {
      id: uuidv4(),
      manufacturer_id: manufacturerId,
      order_id: orderId,
      email_address: emailAddress,
      subject,
      message,
      communication_method: communicationMethod,
      status,
      error_message: errorMessage,
      created_by_user_id: createdByUserId,
      date_created: timestamp,
    }

    log(LogLevel.DEBUG, "logManufacturerEmail", "Logging manufacturer email", {
      manufacturerId,
      emailAddress,
      status,
    })

    const { error } = await supabase.from("manufacturer_email_logs").insert(logEntry)

    if (error) {
      log(LogLevel.ERROR, "logManufacturerEmail", "Error logging manufacturer email", { error, logEntry })
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    log(LogLevel.ERROR, "logManufacturerEmail", "Exception in logManufacturerEmail", error)
    return { success: false, error }
  }
}

export interface ManufacturerCommunicationLogEntry {
  manufacturer_id: string
  purchase_order_id?: string
  contact_id?: string
  employee_id?: string
  communication_type: string
  subject?: string
  message?: string
  email_address?: string
  status?: string
  error_message?: string
}

export async function logManufacturerCommunication(logEntry: ManufacturerCommunicationLogEntry) {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("manufacturer_communication_logs")
      .insert({
        ...logEntry,
        date_created: new Date().toISOString(),
      })
      .select()

    if (error) {
      // Fixed: Use the correct logging function
      log(LogLevel.ERROR, "ManufacturerCommunicationLogger", "Failed to log communication", error)
      return { success: false, error }
    }

    log(LogLevel.INFO, "ManufacturerCommunicationLogger", "Communication logged successfully", { id: data?.[0]?.id })
    return { success: true, data: data?.[0] }
  } catch (error) {
    // Fixed: Use the correct logging function
    log(LogLevel.ERROR, "ManufacturerCommunicationLogger", "Exception logging communication", error)
    return { success: false, error }
  }
}

/**
 * Interface for manufacturer communication log
 */
export interface ManufacturerCommunicationLog {
  id?: string
  manufacturer_id: string
  purchase_order_id?: string
  contact_id?: string | null
  employee_id?: string | null
  email_address: string
  subject: string
  message?: string
  communication_method: "email" | "phone" | "in-person" | "other"
  status: "sent" | "failed" | "pending"
  error_message?: string
  date_created?: string
}

/**
 * Class for logging manufacturer communications
 * This class logs to the manufacturer_communication_logs table
 */
export class ManufacturerCommunicationLogger {
  /**
   * Check if a string is a valid UUID
   */
  private static isValidUuid(id: string): boolean {
    if (!id) return false
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  }

  /**
   * Log a manufacturer communication
   */
  static async logCommunication(entry: ManufacturerCommunicationLog): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate manufacturer_id is present and valid
      if (!entry.manufacturer_id) {
        log(LogLevel.ERROR, "logCommunication", "Missing required manufacturer_id", { entry })
        return { success: false, error: "Missing required manufacturer_id" }
      }

      // Validate UUIDs before sending to database
      if (!this.isValidUuid(entry.manufacturer_id)) {
        log(LogLevel.WARN, "logCommunication", `Invalid manufacturer_id format: ${entry.manufacturer_id}`, { entry })
        return { success: false, error: "Invalid manufacturer ID format" }
      }

      if (entry.purchase_order_id && !this.isValidUuid(entry.purchase_order_id)) {
        log(LogLevel.WARN, "logCommunication", `Invalid purchase_order_id format: ${entry.purchase_order_id}`, {
          entry,
        })
        entry = { ...entry, purchase_order_id: undefined }
      }

      // Use the appropriate client
      const { getSupabaseClient } = await import("@/lib/supabase-client")
      const supabase = getSupabaseClient()

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Create log entry with a generated UUID for the id field
      const logEntry = {
        id: entry.id || uuidv4(), // Generate a new UUID if not provided
        manufacturer_id: entry.manufacturer_id,
        purchase_order_id: entry.purchase_order_id,
        contact_id: entry.contact_id,
        employee_id: entry.employee_id,
        email_address: entry.email_address,
        subject: entry.subject,
        message: entry.message,
        communication_method: entry.communication_method,
        status: entry.status,
        error_message: entry.error_message,
        created_by_user_id: user?.id,
        date_created: new Date().toISOString(),
      }

      log(LogLevel.DEBUG, "logCommunication", "Logging manufacturer communication", {
        manufacturerId: entry.manufacturer_id,
        emailAddress: entry.email_address,
        status: entry.status,
      })

      const { error } = await supabase.from("manufacturer_communication_logs").insert(logEntry)

      if (error) {
        log(LogLevel.ERROR, "logCommunication", "Error logging manufacturer communication", { error, logEntry })
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      log(LogLevel.ERROR, "logCommunication", "Exception in logCommunication", error)
      return { success: false, error: error.message || "An unexpected error occurred" }
    }
  }

  /**
   * Get communication logs for a specific manufacturer
   */
  static async getManufacturerLogs(manufacturerId: string): Promise<any[]> {
    try {
      if (!manufacturerId) {
        log(LogLevel.WARN, "getManufacturerLogs", "Missing required manufacturerId")
        return []
      }

      if (!this.isValidUuid(manufacturerId)) {
        log(LogLevel.WARN, "getManufacturerLogs", `Invalid manufacturer_id format: ${manufacturerId}`)
        return []
      }

      const { getSupabaseClient } = await import("@/lib/supabase-client")
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from("manufacturer_communication_logs")
        .select("*")
        .eq("manufacturer_id", manufacturerId)
        .order("date_created", { ascending: false })

      if (error) {
        log(LogLevel.ERROR, "getManufacturerLogs", "Error fetching manufacturer communication logs", { error })
        return []
      }

      return data || []
    } catch (error) {
      log(LogLevel.ERROR, "getManufacturerLogs", "Exception in getManufacturerLogs", error)
      return []
    }
  }

  /**
   * Get communication logs for a specific purchase order
   */
  static async getPurchaseOrderLogs(orderId: string): Promise<any[]> {
    try {
      if (!orderId) {
        log(LogLevel.WARN, "getPurchaseOrderLogs", "Missing required orderId")
        return []
      }

      if (!this.isValidUuid(orderId)) {
        log(LogLevel.WARN, "getPurchaseOrderLogs", `Invalid order_id format: ${orderId}`)
        return []
      }

      const { getSupabaseClient } = await import("@/lib/supabase-client")
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from("manufacturer_communication_logs")
        .select("*")
        .eq("purchase_order_id", orderId)
        .order("date_created", { ascending: false })

      if (error) {
        log(LogLevel.ERROR, "getPurchaseOrderLogs", "Error fetching purchase order communication logs", { error })
        return []
      }

      return data || []
    } catch (error) {
      log(LogLevel.ERROR, "getPurchaseOrderLogs", "Exception in getPurchaseOrderLogs", error)
      return []
    }
  }
}
