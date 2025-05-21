import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function getPendingStorefrontOrdersCount() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { count, error } = await supabase
      .from("storefront_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "Pending")
      .eq("is_archived", false)

    if (error) {
      console.error("Error fetching pending storefront orders count:", error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error("Error in getPendingStorefrontOrdersCount:", error)
    return 0
  }
}

export async function getDeliveryConflictsCount() {
  // For now, return the default value of 5 as specified
  // This would be replaced with actual logic to count conflicts
  return 5
}

export async function getLowStockCount() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data, error } = await supabase.rpc("count_low_stock_variants")

    if (error) {
      console.error("Error fetching low stock count:", error)
      return 0
    }

    return data || 0
  } catch (error) {
    console.error("Error in getLowStockCount:", error)
    return 0
  }
}
