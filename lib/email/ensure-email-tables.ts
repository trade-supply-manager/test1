import { getSupabaseClient } from "@/lib/supabase-client"

/**
 * Ensures that the necessary tables for email logging exist
 * This function checks for the customer_communication_logs table and creates it if it doesn't exist
 */
export async function ensureEmailTables(): Promise<boolean> {
  const supabase = getSupabaseClient()

  try {
    console.log("🔍 Checking if customer_communication_logs table exists...")

    // Check if the table exists by querying it
    const { error } = await supabase.from("customer_communication_logs").select("id").limit(1)

    // If there's no error, the table exists
    if (!error) {
      console.log("✅ customer_communication_logs table exists")
      return true
    }

    // If the error is not about the table not existing, log it and return false
    if (!error.message.includes("relation") && !error.message.includes("does not exist")) {
      console.error("❌ Error checking customer_communication_logs table:", error)
      return false
    }

    console.log("⚠️ customer_communication_logs table does not exist, creating it...")

    // Create the table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS customer_communication_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID NOT NULL,
        order_id UUID,
        email_address TEXT NOT NULL,
        subject TEXT,
        content TEXT,
        communication_method TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by_user_id UUID
      );
      
      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_customer_communication_logs_customer_id ON customer_communication_logs(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_communication_logs_order_id ON customer_communication_logs(order_id);
      CREATE INDEX IF NOT EXISTS idx_customer_communication_logs_date_created ON customer_communication_logs(date_created);
    `

    // Execute the query using raw SQL
    const { error: createError } = await supabase.rpc("exec_sql", { query: createTableQuery })

    if (createError) {
      console.error("❌ Error creating customer_communication_logs table:", createError)

      // If we don't have permission to create tables, try to use an existing table
      if (createError.message.includes("permission denied")) {
        console.log("⚠️ Permission denied to create table, checking for customer_email_logs...")

        // Check if customer_email_logs exists as an alternative
        const { error: emailLogsError } = await supabase.from("customer_email_logs").select("id").limit(1)

        if (!emailLogsError) {
          console.log("✅ customer_email_logs table exists, will use this instead")
          return true
        }

        console.error("❌ No suitable email logging table found")
        return false
      }

      return false
    }

    console.log("✅ customer_communication_logs table created successfully")
    return true
  } catch (error) {
    console.error("❌ Unexpected error ensuring email tables:", error)
    return false
  }
}
