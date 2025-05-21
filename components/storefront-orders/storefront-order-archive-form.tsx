"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { StorefrontOrderItemsTable } from "./storefront-order-items-table"

interface StorefrontOrderItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  is_archived: boolean | null
}

interface StorefrontOrder {
  id: string
  order_name: string
  status: string
  payment_status: string | null
  total_order_value: number | null
  date_created: string
  is_archived: boolean | null
  customer_id: string
  storefront_customers: {
    id: string
    customer_name: string
  } | null
  storefront_order_items?: StorefrontOrderItem[]
}

interface StorefrontOrderArchiveFormProps {
  order: StorefrontOrder
  itemCount: number
  orderItems: StorefrontOrderItem[]
}

export function StorefrontOrderArchiveForm({ order, itemCount, orderItems }: StorefrontOrderArchiveFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const handleArchive = async () => {
    setIsLoading(true)
    try {
      // Start a transaction to archive all related data
      const timestamp = new Date().toISOString()

      // 1. Archive the order
      const { error: orderError } = await supabase
        .from("storefront_orders")
        .update({
          is_archived: true,
          date_last_updated: timestamp,
        })
        .eq("id", order.id)

      if (orderError) throw orderError

      // 2. Archive all order items
      if (orderItems && orderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("storefront_order_items")
          .update({
            is_archived: true,
            date_last_updated: timestamp,
          })
          .eq("order_id", order.id)

        if (itemsError) throw itemsError
      }

      // 3. Archive the customer
      if (order.customer_id) {
        const { error: customerError } = await supabase
          .from("storefront_customers")
          .update({
            is_archived: true,
            date_last_updated: timestamp,
          })
          .eq("id", order.customer_id)

        if (customerError) throw customerError
      }

      toast({
        title: "Order archived",
        description: "The order and all related data have been archived successfully.",
      })

      // Explicitly redirect to the storefront orders list and ensure we don't go to the detail page
      router.push("/dashboard/storefront-orders")

      // Force a refresh to ensure the UI updates with the latest data
      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while archiving the order",
      })

      // Even on error, redirect to the safe list page
      router.push("/dashboard/storefront-orders")
    } finally {
      setIsLoading(false)
    }
  }

  // Add a safeguard to prevent navigation to the detail page
  const handleCancel = () => {
    router.push("/dashboard/storefront-orders")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Archive Order</CardTitle>
          <CardDescription>
            Are you sure you want to archive this order? This will also archive all related order items and the
            customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This action will archive the order, {itemCount} order items, and the customer record. This action cannot
              be undone automatically.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Order Details</h3>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="font-medium">Order Name:</span> {order.order_name}
                </div>
                <div>
                  <span className="font-medium">Date Created:</span> {formatDate(order.date_created)}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {order.status}
                </div>
                <div>
                  <span className="font-medium">Payment Status:</span> {order.payment_status || "N/A"}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Customer Information</h3>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="font-medium">Customer:</span>{" "}
                  {order.storefront_customers?.customer_name || "Unknown Customer"}
                </div>
                <div>
                  <span className="font-medium">Total Order Value:</span> {formatCurrency(order.total_order_value)}
                </div>
                <div>
                  <span className="font-medium">Order Items:</span> {itemCount}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {/* Replace Link with Button that uses router.push */}
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleArchive} disabled={isLoading} variant="destructive">
            {isLoading ? "Archiving..." : "Archive Order & Related Data"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
          <CardDescription>The following items will be archived along with the order.</CardDescription>
        </CardHeader>
        <CardContent>
          <StorefrontOrderItemsTable items={orderItems} />
        </CardContent>
      </Card>
    </div>
  )
}
