export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

// Global flag to enable/disable debug logging
const DEBUG_ENABLED = process.env.DEBUG_EMAIL === "true"

export function log(level: LogLevel, category: string, message: string, data?: any): void {
  if (!DEBUG_ENABLED && level === LogLevel.DEBUG) {
    return // Skip debug logs unless DEBUG_EMAIL is enabled
  }

  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level}] [${category}]`

  if (data) {
    console.log(`${prefix} ${message}`, data)
  } else {
    console.log(`${prefix} ${message}`)
  }
}

export function debugEmailState(
  orderId: string,
  contactIds: string[],
  employeeIds: string[],
  includePrimaryContact: boolean,
  additionalInfo: string,
): void {
  if (!DEBUG_ENABLED) return

  log(LogLevel.DEBUG, "EMAIL_STATE", "Email sending state", {
    orderId,
    contactIds,
    employeeIds,
    contactCount: contactIds.length,
    employeeCount: employeeIds.length,
    includePrimaryContact,
    additionalInfo: additionalInfo || "None",
  })
}

export function debugEmailSending(
  toEmails: string[],
  ccEmails: string[],
  subject: string,
  hasAttachments: boolean,
): void {
  if (!DEBUG_ENABLED) return

  log(LogLevel.DEBUG, "EMAIL_SENDING", "Preparing to send email", {
    to: toEmails,
    cc: ccEmails,
    toCount: toEmails.length,
    ccCount: ccEmails.length,
    subject,
    hasAttachments,
  })
}

export function debugEmailResult(success: boolean, error?: string): void {
  if (!DEBUG_ENABLED) return

  if (success) {
    log(LogLevel.DEBUG, "EMAIL_RESULT", "Email sent successfully")
  } else {
    log(LogLevel.DEBUG, "EMAIL_RESULT", "Email sending failed", { error })
  }
}

// Helper to check environment variables
export const emailDebug = {
  event: (category: string, message: string, data?: any) => {
    log(LogLevel.INFO, category, message, data)
  },
  error: (category: string, message: string, data?: any) => {
    log(LogLevel.ERROR, category, message, data)
  },
  warning: (category: string, message: string, data?: any) => {
    log(LogLevel.WARN, category, message, data)
  },
  env: (requiredVars: string[]) => {
    const missing: string[] = []
    const present: string[] = []

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName)
      } else {
        present.push(varName)
      }
    }

    if (missing.length > 0) {
      log(LogLevel.WARN, "ENV_CHECK", "Missing required environment variables", { missing })
    }

    return { missing, present }
  },
}
