"use client"

// Place any client-only utility functions here
// For example, functions that use browser APIs like localStorage, window, etc.

export function isBrowser(): boolean {
  return typeof window !== "undefined"
}

// Add other client-only utilities as needed
