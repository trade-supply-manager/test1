import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CustomerOrderForm } from "@/components/customer-orders/customer-order-form"
import { ArrowLeft } from "lucide-react"

export default async function EditCustomerOrderPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })
  const { id } = params

  try {
    // Fetch order details with more detailed error handling
    const { data: order, error: orderError } = await supabase.from("customer_orders").select("*").eq("id", id).single()

    if (orderError) {
      console.error("Error fetching order:", orderError)
      throw new Error(`Failed to fetch order: ${orderError.message}`)
    }

    if (!order) {
      console.error("Order not found with ID:", id)
      return notFound()
    }

    // Log the order data to help with debugging
    console.log("Order data fetched:", order)

    // Fetch customers for the dropdown
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id, customer_name, email") // Add email to the select
      .order("customer_name", { ascending: true })

    if (customersError) {
      console.error("Error fetching customers:", customersError)
      throw new Error(`Failed to fetch customers: ${customersError.message}`)
    }

    // Fetch products with their variants
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(`
        id, 
        product_name, 
        product_category,
        unit,
        feet_per_layer,
        layers_per_pallet,
        manufacturer_id,
        product_variants (
          id, 
          product_variant_name, 
          product_variant_sku,
          unit_price,
          quantity,
          is_pallet,
          pallets,
          layers
        )
      `)
      .eq("is_archived", false)
      .order("product_name", { ascending: true })

    if (productsError) {
      console.error("Error fetching products:", productsError)
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/customer-orders/${id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Order
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Edit Order: {order.order_name}</h1>
          </div>
        </div>

        <CustomerOrderForm customers={customers || []} products={products || []} orderId={id} initialData={order} />
      </div>
    )
  } catch (error) {
    console.error("Error in EditCustomerOrderPage:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Link href="/dashboard/customer-orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Edit Order</h1>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">
            {(error as Error).message || "An error occurred while loading the page."}
          </span>
        </div>
        <div className="flex justify-center">
          <Link href="/dashboard/customer-orders">
            <Button>Return to Orders</Button>
          </Link>
        </div>
      </div>
    )
  }
}
