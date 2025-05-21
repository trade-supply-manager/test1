import { getServerSupabaseClient, getSupabaseServer } from "./supabase-server"

/**
 * Fetches data with retry mechanism
 * @param queryFn Function that performs the actual query
 * @param options Configuration options
 * @returns Query result or error
 */
export async function fetchWithRetry<T>(
  queryFn: (client: ReturnType<typeof getServerSupabaseClient>) => Promise<{ data: T | null; error: any }>,
  options: {
    maxRetries?: number
    useServiceRole?: boolean
    retryDelay?: number
  } = {},
) {
  const { maxRetries = 3, useServiceRole = false, retryDelay = 300 } = options

  let retries = 0
  let lastError = null

  while (retries < maxRetries) {
    try {
      // Use either user context or service role based on options
      const client = useServiceRole ? getSupabaseServer() : getServerSupabaseClient()
      const result = await queryFn(client)

      if (result.error) {
        // If it's an authentication error and we're not using service role,
        // try with service role if this is the last retry
        if (
          result.error.code === "PGRST301" || // JWT expired
          result.error.code === "PGRST302" || // JWT invalid
          result.error.message?.includes("JWT")
        ) {
          if (retries === maxRetries - 1 && !useServiceRole) {
            console.warn("Falling back to service role due to auth error")
            const serviceClient = getSupabaseServer()
            return await queryFn(serviceClient)
          }
        }

        throw result.error
      }

      return { data: result.data, error: null }
    } catch (error) {
      lastError = error
      retries++

      if (retries < maxRetries) {
        // Wait before retrying with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, retries - 1)))
      }
    }
  }

  return { data: null, error: lastError }
}
