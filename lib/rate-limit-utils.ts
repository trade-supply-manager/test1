/**
 * Utility function to retry a function when rate limit errors occur
 * @param fn The function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param initialDelay Initial delay in ms before first retry (default: 500)
 * @returns The result of the function
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 500): Promise<T> {
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
