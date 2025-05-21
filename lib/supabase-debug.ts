"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { createClient } from "@supabase/supabase-js"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

// Track all client creation
const clientInstances = new Set()
const creationPoints = []

// Add a global debug object
declare global {
  interface Window {
    __SUPABASE_DEBUG__: {
      clientInstances: Set<any>
      creationPoints: any[]
      logAllClients: () => void
      checkGoTrueInstances: () => void
    }
  }
}

// Initialize the debug object if we're in the browser
if (typeof window !== "undefined") {
  window.__SUPABASE_DEBUG__ = {
    clientInstances,
    creationPoints,
    logAllClients: () => {
      console.log("All Supabase clients:", {
        count: clientInstances.size,
        creationPoints,
      })
    },
    checkGoTrueInstances: () => {
      // @ts-ignore - Accessing internal property for debugging
      const instances = window._supabase?.GoTrueClient?.instances || []
      console.log("GoTrueClient instances:", instances.length)
    },
  }

  // Monkey patch client creation methods if they exist
  if (typeof createClientComponentClient === "function") {
    const originalCreateClientComponentClient = createClientComponentClient
    // @ts-ignore - Intentionally overriding for debugging
    window.createClientComponentClient = (...args) => {
      const client = originalCreateClientComponentClient(...args)
      const stack = new Error().stack

      clientInstances.add(client)
      creationPoints.push({
        type: "createClientComponentClient",
        timestamp: new Date().toISOString(),
        location: stack?.split("\n")[2]?.trim() || "unknown",
        clientId: Math.random().toString(36).substring(2, 9),
      })

      console.warn(`[SUPABASE DEBUG] Client created via createClientComponentClient`, {
        location: stack?.split("\n")[2]?.trim() || "unknown",
        totalClients: clientInstances.size,
      })

      return client
    }
  }

  if (typeof createClient === "function") {
    const originalCreateClient = createClient
    // @ts-ignore - Intentionally overriding for debugging
    window.createClient = (...args) => {
      const client = originalCreateClient(...args)
      const stack = new Error().stack

      clientInstances.add(client)
      creationPoints.push({
        type: "createClient",
        timestamp: new Date().toISOString(),
        location: stack?.split("\n")[2]?.trim() || "unknown",
        clientId: Math.random().toString(36).substring(2, 9),
      })

      console.warn(`[SUPABASE DEBUG] Client created via createClient`, {
        location: stack?.split("\n")[2]?.trim() || "unknown",
        totalClients: clientInstances.size,
      })

      return client
    }
  }

  if (typeof createMiddlewareClient === "function") {
    const originalCreateMiddlewareClient = createMiddlewareClient
    // @ts-ignore - Intentionally overriding for debugging
    window.createMiddlewareClient = (...args) => {
      const client = originalCreateMiddlewareClient(...args)
      const stack = new Error().stack

      clientInstances.add(client)
      creationPoints.push({
        type: "createMiddlewareClient",
        timestamp: new Date().toISOString(),
        location: stack?.split("\n")[2]?.trim() || "unknown",
        clientId: Math.random().toString(36).substring(2, 9),
      })

      console.warn(`[SUPABASE DEBUG] Client created via createMiddlewareClient`, {
        location: stack?.split("\n")[2]?.trim() || "unknown",
        totalClients: clientInstances.size,
      })

      return client
    }
  }
}

export function getClientCreationInfo() {
  if (typeof window === "undefined") {
    return { totalClients: 0, creationPoints: [] }
  }
  return {
    totalClients: clientInstances.size,
    creationPoints,
  }
}

export function checkGoTrueInstances() {
  if (typeof window === "undefined") {
    return 0
  }
  // @ts-ignore - Accessing internal property for debugging
  const instances = window._supabase?.GoTrueClient?.instances || []
  console.log("GoTrueClient instances:", instances.length)
  return instances.length
}
