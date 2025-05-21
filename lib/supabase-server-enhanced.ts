import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

// Exponential backoff retry function
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 500): Promise<T> {
  let retries = 0

  while (true) {
    try {
      return await fn()
    } catch (error: any) {
      // Check if this is a rate limit error
      const isRateLimitError =
        error?.message?.includes("Too Many Requests") || error?.code === 429 || error?.status === 429

      // If we've reached max retries or it's not a rate limit error, throw
      if (retries >= maxRetries || !isRateLimitError) {
        throw error
      }

      // Calculate delay with exponential backoff (500ms, 1000ms, 2000ms, etc.)
      const delay = initialDelay * Math.pow(2, retries)

      // Log the retry attempt
      console.warn(`Rate limit hit, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries})`)

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Increment retry counter
      retries++
    }
  }
}

export function getEnhancedServerSupabaseClient() {
  const supabase = createServerComponentClient<Database>({ cookies })

  // Return a proxy that wraps all methods with retry logic
  return new Proxy(supabase, {
    get(target, prop) {
      const value = target[prop as keyof typeof target]

      // If the property is a function that returns a query builder
      if (prop === "from") {
        return (...args: any[]) => {
          const queryBuilder = value.apply(target, args)

          // Wrap the final execution methods with retry logic
          const originalSingle = queryBuilder.single
          queryBuilder.single = () => withRetry(() => originalSingle.apply(queryBuilder))

          const originalExecute = queryBuilder.execute
          queryBuilder.execute = () => withRetry(() => originalExecute.apply(queryBuilder))

          return queryBuilder
        }
      }

      return value
    },
  })
}

// Keep the original function for backward compatibility
export function getServerSupabaseClient() {
  return createServerComponentClient<Database>({ cookies })
}
