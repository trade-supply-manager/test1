import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { DeliveriesPage } from "@/components/deliveries/deliveries-page"
import { CalendarClock } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Deliveries | Trade Supply Manager",
  description: "View and manage upcoming deliveries",
}

export default async function DeliveriesPageWrapper() {
  const supabase = createServerComponentClient({ cookies })

  // Fetch customer orders with delivery dates
  const { data: orders, error } = await supabase
    .from("customer_orders")
    .select(`
      id,
      order_name,
      delivery_date,
      status,
      delivery_time,
      total_order_value,
      customers (
        id,
        customer_name
      )
    `)
    .order("delivery_date", { ascending: true })

  if (error) {
    console.error("Error fetching orders:", error)
    return <div>Error loading deliveries</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upcoming Deliveries</h1>
          <p className="text-muted-foreground">View and manage all scheduled customer order deliveries</p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
          <CalendarClock className="h-5 w-5 text-blue-600" />
        </div>
      </div>

      <DeliveriesPage orders={orders || []} />
    </div>
  )
}
