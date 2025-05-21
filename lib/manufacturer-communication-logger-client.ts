import { getSupabaseClient } from "@/lib/supabase-client"
import { log, LogLevel } from "@/lib/debug-utils" // Correct import
import type { ManufacturerCommunicationLogEntry } from "./manufacturer-communication-logger"

export async function logManufacturerCommunicationClient(logEntry: ManufacturerCommunicationLogEntry) {
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
      log(LogLevel.ERROR, "ManufacturerCommunicationLoggerClient", "Failed to log communication", error)
      return { success: false, error }
    }

    log(LogLevel.INFO, "ManufacturerCommunicationLoggerClient", "Communication logged successfully", {
      id: data?.[0]?.id,
    })
    return { success: true, data: data?.[0] }
  } catch (error) {
    // Fixed: Use the correct logging function
    log(LogLevel.ERROR, "ManufacturerCommunicationLoggerClient", "Exception logging communication", error)
    return { success: false, error }
  }
}
