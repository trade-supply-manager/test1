import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

/**
 * Creates a Supabase client for server components with user context
 * This uses the user's session from cookies
 */
export function getServerSupabaseClient() {
  // We don't cache this client because cookies might change between requests
  return createServerComponentClient<Database>({ cookies })
}
