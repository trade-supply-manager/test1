import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CustomerOrderTable } from "@/components/customer-orders/customer-order-table"
import { PlusCircle } from "lucide-react"

export default async function CustomerOrdersPage() {
  const supabase = createServerComponentClient({ cookies })

  const { data: orders } = await supabase
    .from("customer_orders")
    .select(`
      *,
      customers (
        customer_name
      )
    `)
    .order("date_created", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Customer Orders</h1>
        <Link href="/dashboard/customer-orders/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            New Customer Order
          </Button>
        </Link>
      </div>

      <CustomerOrderTable orders={orders || []} />
    </div>
  )
}
