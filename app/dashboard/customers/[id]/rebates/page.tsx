import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart3 } from "lucide-react"
import { CustomerBreadcrumb } from "@/components/customers/customer-breadcrumb"
import { VolumeRebatesTable } from "@/components/customers/volume-rebates-table"

interface VolumeRebatesPageProps {
  params: {
    id: string
  }
}

export default async function VolumeRebatesPage({ params }: VolumeRebatesPageProps) {
  const supabase = createServerComponentClient({ cookies })

  // Fetch customer data
  const { data: customer } = await supabase.from("customers").select("*").eq("id", params.id).single()

  if (!customer) {
    notFound()
  }

  // First, fetch the customer orders
  const { data: orders, error: ordersError } = await supabase
    .from("customer_orders")
    .select("id, order_name, date_created, delivery_date, status, payment_status, total_order_value")
    .eq("customer_id", params.id)
    .order("date_created", { ascending: false })

  if (ordersError) {
    console.error("Error fetching orders:", ordersError)
  }

  // Then, fetch the order items with correct field names and joins
  // Now including manufacturer information
  let orderItems = []
  if (orders && orders.length > 0) {
    const orderIds = orders.map((order) => order.id)

    // Using a more detailed query to get all the required fields
    // Now including products.manufacturer_id and manufacturers.manufacturer_name
    const { data: items, error: itemsError } = await supabase
      .from("customer_order_items")
      .select(`
        customer_order_id,
        quantity,
        unit_price,
        total_order_item_value,
        products (
          id,
          product_name,
          manufacturer_id,
          manufacturers (
            id,
            manufacturer_name
          )
        ),
        product_variants (
          id,
          product_variant_name,
          product_variant_sku
        )
      `)
      .in("customer_order_id", orderIds)

    if (itemsError) {
      console.error("Error fetching order items:", itemsError)
    } else {
      // Transform the data to match our expected format
      // Now including manufacturer_name
      orderItems = (items || []).map((item) => ({
        customer_order_id: item.customer_order_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_order_item_value,
        product_name: item.products?.product_name || "Unknown Product",
        product_variant_name: item.product_variants?.product_variant_name || null,
        product_variant_sku: item.product_variants?.product_variant_sku || null,
        manufacturer_name: item.products?.manufacturers?.manufacturer_name || "Unknown Manufacturer",
        manufacturer_id: item.products?.manufacturer_id || null,
      }))
    }
  }

  // Combine the data
  const ordersWithItems =
    orders?.map((order) => ({
      ...order,
      customer_order_items: orderItems.filter((item) => item.customer_order_id === order.id) || [],
    })) || []

  // Log for debugging
  console.log(`Found ${ordersWithItems.length} orders with ${orderItems.length} items for customer ${params.id}`)

  return (
    <div className="space-y-6">
      <CustomerBreadcrumb
        customerId={params.id}
        customerName={customer.customer_name}
        additionalCrumbs={[{ label: "Volume Rebates", href: `/dashboard/customers/${params.id}/rebates` }]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/customers/${params.id}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Volume Rebates
          </h1>
        </div>
        <div className="text-sm text-muted-foreground">
          Customer: <span className="font-medium text-foreground">{customer.customer_name}</span>
        </div>
      </div>

      <VolumeRebatesTable initialOrders={ordersWithItems} customerId={params.id} />
    </div>
  )
}
