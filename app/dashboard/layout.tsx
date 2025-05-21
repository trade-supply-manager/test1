import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { SidebarWithBadges } from "@/components/sidebar-with-badges"
import { getServerSupabaseClient } from "@/lib/supabase-server"
import { getPendingStorefrontOrdersCount, getDeliveryConflictsCount, getLowStockCount } from "@/lib/badge-counts"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  try {
    console.log("[DashboardLayout] Initializing dashboard layout")
    const supabase = getServerSupabaseClient()

    // Use getUser instead of getSession for better security
    console.log("[DashboardLayout] Getting authenticated user")
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    // Handle user authentication error
    if (userError) {
      console.error("[DashboardLayout] User authentication error:", {
        code: userError.code,
        message: userError.message,
        status: userError.status,
      })

      // Redirect with specific error information
      const searchParams = new URLSearchParams({
        error: "auth",
        message: userError.message,
      })
      redirect(`/auth/login?${searchParams.toString()}`)
    }

    // If no authenticated user, redirect to login
    if (!user) {
      console.log("[DashboardLayout] No authenticated user found, redirecting to login")
      const searchParams = new URLSearchParams({
        error: "auth",
        message: "Please sign in to access the dashboard",
      })
      redirect(`/auth/login?${searchParams.toString()}`)
    }

    // Get session for additional checks if needed
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("[DashboardLayout] Session error:", {
        code: sessionError.code,
        message: sessionError.message,
        status: sessionError.status,
      })
    }

    // Fetch badge counts
    const [pendingStorefrontOrdersCount, deliveryConflictsCount, lowStockCount] = await Promise.all([
      getPendingStorefrontOrdersCount(),
      getDeliveryConflictsCount(),
      getLowStockCount(),
    ])

    // Log successful user validation
    console.log("[DashboardLayout] User authenticated successfully", {
      userId: user.id,
      email: user.email ? `${user.email.substring(0, 3)}***${user.email.substring(user.email.lastIndexOf("@"))}` : null,
      role: user.role,
    })

    return (
      <div className="flex h-screen">
        <SidebarWithBadges
          pendingStorefrontOrdersCount={pendingStorefrontOrdersCount}
          deliveryConflictsCount={deliveryConflictsCount}
          lowStockCount={lowStockCount}
        />
        <div className="flex-1 relative">
          <main className="absolute inset-0 overflow-y-auto bg-gray-50 p-6">{children}</main>
        </div>
      </div>
    )
  } catch (error: any) {
    // Enhanced error logging
    console.error("[DashboardLayout] Unhandled error:", {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })

    // Determine error type for better user feedback
    let errorType = "unknown"
    let errorMessage = "An unexpected error occurred"

    if (error.message?.includes("fetch")) {
      errorType = "network"
      errorMessage = "Network connection error"
    } else if (error.message?.includes("auth")) {
      errorType = "auth"
      errorMessage = "Authentication error"
    }

    // Redirect with error information
    const searchParams = new URLSearchParams({
      error: errorType,
      message: errorMessage,
    })
    redirect(`/auth/login?${searchParams.toString()}`)
  }
}
