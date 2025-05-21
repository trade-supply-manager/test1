import { notFound } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Printer } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { CustomerCommunicationLogs } from "@/components/customers/customer-communication-logs"

export default async function CustomerOrderDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  // Fetch the order details
  const { data: order, error } = await supabase
    .from("customer_orders")
    .select(
      `
      *,
      customers (
        id,
        customer_name,
        email,
        phone_number,
        address
      )
    `,
    )
    .eq("id", params.id)
    .single()

  if (error || !order) {
    console.error("Error fetching order:", error)
    notFound()
  }

  // Fetch order items
  const { data: orderItems } = await supabase
    .from("customer_order_items")
    .select(
      `
      *,
      products (
        product_name,
        unit
      ),
      product_variants (
        product_variant_name,
        product_variant_sku
      )
    `,
    )
    .eq("customer_order_id", params.id)
    .eq("is_archived", false)

  // Calculate order totals
  const subtotal = orderItems?.reduce((sum, item) => sum + (item.total_order_item_value || 0), 0) || 0
  const orderDiscountPercentage = order.discount_percentage || 0
  const orderDiscountAmount = subtotal * (orderDiscountPercentage / 100)
  const discountedSubtotal = subtotal - orderDiscountAmount
  const taxRate = order.tax_rate || 13 // Default to 13% if not specified
  const taxAmount = discountedSubtotal * (taxRate / 100)
  const total = discountedSubtotal + taxAmount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/dashboard/customer-orders">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Order Details</h1>
        </div>
        <div className="flex space-x-2">
          <Link href={`/dashboard/customer-orders/${params.id}/pdf`} target="_blank">
            <Button variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Generate Invoice
            </Button>
          </Link>
          <Link href={`/dashboard/customer-orders/${params.id}/edit`}>
            <Button>Edit Order</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
            <CardDescription>Basic order details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Order Number</div>
              <div className="font-mono text-lg">{order.order_name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Date Created</div>
              <div>{new Date(order.date_created).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div>{order.status}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Payment Status</div>
              <div>{order.payment_status}</div>
            </div>
            {orderDiscountPercentage > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Order Discount</div>
                <div>{orderDiscountPercentage}%</div>
              </div>
            )}
            {order.notes && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Notes</div>
                <div className="whitespace-pre-wrap">{order.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Customer details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Customer Name</div>
              <div className="font-medium">
                <Link href={`/dashboard/customers/${order.customer_id}`} className="text-blue-600 hover:underline">
                  {order.customers?.customer_name}
                </Link>
              </div>
            </div>
            {order.customers?.email && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Email</div>
                <div>{order.customers.email}</div>
              </div>
            )}
            {order.customers?.phone_number && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Phone</div>
                <div>{order.customers.phone_number}</div>
              </div>
            )}
            {order.customers?.address && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Address</div>
                <div className="whitespace-pre-wrap">{order.customers.address}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Information</CardTitle>
            <CardDescription>Delivery details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Delivery Method</div>
              <div>{order.delivery_method}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Delivery Date</div>
              <div>{new Date(order.delivery_date).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Delivery Time</div>
              <div>{order.delivery_time}</div>
            </div>
            {order.delivery_address && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Delivery Address</div>
                <div className="whitespace-pre-wrap">{order.delivery_address}</div>
              </div>
            )}
            {order.delivery_instructions && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Delivery Instructions</div>
                <div className="whitespace-pre-wrap">{order.delivery_instructions}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
          <CardDescription>
            Items included in this order
            {orderDiscountPercentage > 0 && (
              <span className="ml-2 inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                Order-level discount of {orderDiscountPercentage}% applied
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-4 text-left">Product</th>
                  <th className="py-2 px-4 text-left">SKU</th>
                  <th className="py-2 px-4 text-right">Quantity</th>
                  <th className="py-2 px-4 text-right">Unit Price</th>
                  <th className="py-2 px-4 text-right">Discount</th>
                  <th className="py-2 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orderItems?.map((item) => (
                  <tr key={item.customer_order_item_id} className="border-b">
                    <td className="py-2 px-4">
                      {item.product_variants?.product_variant_name
                        ? `${item.products?.product_name} - ${item.product_variants.product_variant_name}`
                        : item.products?.product_name}
                    </td>
                    <td className="py-2 px-4">{item.product_variants?.product_variant_sku || "N/A"}</td>
                    <td className="py-2 px-4 text-right">
                      {item.quantity} {item.products?.unit || "ea"}
                    </td>
                    <td className="py-2 px-4 text-right">{formatCurrency(item.unit_price || 0)}</td>
                    <td className="py-2 px-4 text-right">
                      {item.discount ? formatCurrency(item.discount) : "-"}
                      {item.discount_percentage ? ` (${item.discount_percentage.toFixed(2)}%)` : ""}
                    </td>
                    <td className="py-2 px-4 text-right">{formatCurrency(item.total_order_item_value || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="py-2 px-4"></td>
                  <td className="py-2 px-4 text-right font-medium">Subtotal:</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(subtotal)}</td>
                </tr>
                {orderDiscountPercentage > 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 px-4"></td>
                    <td className="py-2 px-4 text-right font-medium">
                      <span className="flex items-center justify-end gap-1">
                        Order Discount:
                        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {orderDiscountPercentage}%
                        </span>
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-red-600">-{formatCurrency(orderDiscountAmount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="py-2 px-4"></td>
                  <td className="py-2 px-4 text-right font-medium">Tax ({taxRate}%):</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(taxAmount)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2 px-4"></td>
                  <td className="py-2 px-4 text-right font-medium">Total:</td>
                  <td className="py-2 px-4 text-right font-bold">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add the new Communication Logs component */}
      <CustomerCommunicationLogs customerId={order.customer_id} orderId={params.id} />
    </div>
  )
}
