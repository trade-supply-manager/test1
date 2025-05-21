import { notFound } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { OrderReturnsForm } from "@/components/customer-orders/order-returns-form"

export const dynamic = "force-dynamic"

export default async function ReturnsPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return notFound()
    }

    // Fetch the order details
    const { data: order, error } = await supabase
      .from("customer_orders")
      .select(
        `
        *,
        customers (
          id,
          customer_name
        )
      `,
      )
      .eq("id", params.id)
      .single()

    if (error || !order) {
      console.error("Error fetching order:", error)
      return notFound()
    }

    // Fetch order items
    const { data: orderItems, error: itemsError } = await supabase
      .from("customer_order_items")
      .select(
        `
        customer_order_item_id,
        product_id,
        variant_id,
        unit_price,
        quantity,
        discount_percentage,
        discount,
        total_order_item_value,
        products (
          product_name,
          unit
        ),
        product_variants (
          product_variant_name
        )
      `,
      )
      .eq("customer_order_id", params.id)
      .eq("is_archived", false)

    if (itemsError) {
      console.error("Error fetching order items:", itemsError)
      return notFound()
    }

    // Format order items for the returns form
    const formattedItems = orderItems.map((item) => ({
      id: item.customer_order_item_id,
      product_name: item.products?.product_name || "Unknown Product",
      variant_name: item.product_variants?.product_variant_name || "Default Variant",
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      total_order_item_value: item.total_order_item_value || 0,
      unit: item.products?.unit || null,
    }))

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Link href={`/dashboard/customer-orders/${params.id}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Process Return</h1>
        </div>

        <OrderReturnsForm
          orderId={params.id}
          orderName={order.order_name}
          orderItems={formattedItems}
          customerName={order.customers?.customer_name || "Unknown Customer"}
          userId={user.id}
        />
      </div>
    )
  } catch (error) {
    console.error("Unexpected error:", error)
    return notFound()
  }
}
