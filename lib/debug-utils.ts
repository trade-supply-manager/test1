/**
 * Enhanced utility functions for debugging and logging
 */

// Define log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

// Set this to control the logging level
// In production, this would typically be lower (ERROR or WARN)
const CURRENT_LOG_LEVEL =
  typeof window === "undefined"
    ? process.env.NODE_ENV === "development"
      ? LogLevel.DEBUG
      : LogLevel.WARN
    : LogLevel.WARN // Default to WARN on client-side

// Level names for display
const LEVEL_NAMES = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"]

// Safe object logging - redacts sensitive values
const sanitizeObject = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj

  const sanitized = { ...obj }

  // List of sensitive key patterns
  const sensitiveKeys = [/key/i, /token/i, /password/i, /secret/i, /credential/i, /auth/i]

  Object.keys(sanitized).forEach((key) => {
    // Check if this is a sensitive key
    const isSensitive = sensitiveKeys.some((pattern) => pattern.test(key))

    if (isSensitive && typeof sanitized[key] === "string") {
      // Redact the value but show length and first/last characters for debugging
      const val = sanitized[key]
      if (val.length > 8) {
        sanitized[key] = `${val.substring(0, 3)}...${val.substring(val.length - 3)} (${val.length} chars)`
      } else {
        sanitized[key] = "***" + val.length
      }
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(sanitized[key])
    }
  })

  return sanitized
}

/**
 * Enhanced logging function with formatted output
 * @param level - Log level (ERROR, WARN, INFO, DEBUG, TRACE)
 * @param component - Component or module name
 * @param message - Log message
 * @param data - Optional data to include in the log
 * @param error - Optional error object to include stack trace
 */
export function log(level: LogLevel, component: string, message: string, data?: any, error?: Error) {
  if (level <= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString()
    const formattedTimestamp = timestamp.split("T")[1].split(".")[0] // HH:MM:SS format
    const isClient = typeof window !== "undefined"
    const context = isClient ? "[CLIENT]" : "[SERVER]"

    // Safe data logging
    const safeData = data ? sanitizeObject(data) : undefined

    console.log(
      `${context} [${LEVEL_NAMES[level]} ${formattedTimestamp}] [${component}] ${message}`,
      safeData !== undefined ? safeData : "",
    )

    // If we have an error and this is an error log, output the stack trace
    if (error && level === LogLevel.ERROR) {
      console.error(`Stack trace:`, error)
    }
  }
}

/**
 * Log debug information
 */
export function logDebug(component: string, message: string, data?: any) {
  log(LogLevel.DEBUG, component, message, data)
}

/**
 * Log information
 */
export function logInfo(component: string, message: string, data?: any) {
  log(LogLevel.INFO, component, message, data)
}

/**
 * Log warnings
 */
export function logWarn(component: string, message: string, data?: any) {
  log(LogLevel.WARN, component, message, data)
}

/**
 * Log errors with stack trace
 */
export function logError(component: string, message: string, error?: Error, data?: any) {
  log(LogLevel.ERROR, component, message, data, error)
}

/**
 * Log trace information (most detailed level)
 */
export function logTrace(component: string, message: string, data?: any) {
  log(LogLevel.TRACE, component, message, data)
}

/**
 * Legacy debug log function - maintained for backward compatibility
 */
export function debugLog(componentName: string, message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const isClient = typeof window !== "undefined"
  const context = isClient ? "[CLIENT]" : "[SERVER]"
  console.log(`${context} [${timestamp}] [${componentName}] ${message}`, data !== undefined ? data : "")
}

// Check environment variables safely
export function checkEnvironmentVariables() {
  const isClient = typeof window !== "undefined"

  // Only check these on the server side
  if (!isClient) {
    const serverVars = {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_URL: maskValue(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: maskValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
      SUPABASE_JWT_SECRET: maskValue(process.env.SUPABASE_JWT_SECRET),
      RESEND_API_KEY: maskValue(process.env.RESEND_API_KEY),
    }

    logInfo("EnvCheck", "Server environment variables", serverVars)
  }

  // These can be checked on both client and server
  const clientVars = {
    NEXT_PUBLIC_SUPABASE_URL: maskValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: maskValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  }

  logInfo("EnvCheck", `${isClient ? "Client" : "Server"} public environment variables`, clientVars)

  // Check for missing critical variables
  const missingVars = []

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missingVars.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (!isClient) {
    if (!process.env.SUPABASE_URL) missingVars.push("SUPABASE_URL")
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingVars.push("SUPABASE_SERVICE_ROLE_KEY")
    if (!process.env.RESEND_API_KEY) missingVars.push("RESEND_API_KEY")
  }

  if (missingVars.length > 0) {
    logError("EnvCheck", "Missing critical environment variables", { missing: missingVars })
    return false
  }

  return true
}

// Helper function to mask sensitive values
function maskValue(value?: string): string {
  if (!value) return "undefined"
  if (value.length <= 8) return "***" + value.length
  return `${value.substring(0, 3)}...${value.substring(value.length - 3)} (${value.length} chars)`
}

// Validate product variants data - keep existing function
export function validateProductVariants(variants: any[]) {
  if (!variants || variants.length === 0) {
    debugLog("Validator", "No variants found")
    return false
  }

  const issues = []

  // Check for variants with missing product_id
  const variantsWithoutProductId = variants.filter((v) => !v.product_id)
  if (variantsWithoutProductId.length > 0) {
    issues.push(`${variantsWithoutProductId.length} variants without product_id`)
  }

  // Check for variants with missing id
  const variantsWithoutId = variants.filter((v) => !v.id)
  if (variantsWithoutId.length > 0) {
    issues.push(`${variantsWithoutId.length} variants without id`)
  }

  // Check for variants with missing name
  const variantsWithoutName = variants.filter((v) => !v.product_variant_name)
  if (variantsWithoutName.length > 0) {
    issues.push(`${variantsWithoutName.length} variants without product_variant_name`)
  }

  if (issues.length > 0) {
    debugLog("Validator", `Variant data issues: ${issues.join(", ")}`)
    return false
  }

  return true
}
