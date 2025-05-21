"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface StorefrontCustomer {
  id: string
  customer_name: string
  email: string
  phone_number: string
}

interface StorefrontOrder {
  id: string
  order_name: string
  status: string
  customer_id: string
  storefront_customers: StorefrontCustomer | null
}

interface StorefrontOrderRejectFormProps {
  order: StorefrontOrder
}

export function StorefrontOrderRejectForm({ order }: StorefrontOrderRejectFormProps) {
  const [rejectionReason, setRejectionReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Rejection reason required",
        description: "Please provide a reason for rejecting this order.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/storefront-orders/${order.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rejectionReason,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject the order")
      }

      toast({
        title: "Order rejected",
        description: "The order has been rejected successfully.",
      })

      // Redirect to the storefront orders list
      router.push("/dashboard/storefront-orders")
      router.refresh()
    } catch (error: any) {
      console.error("Error in handleReject:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while rejecting the order",
      })
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push("/dashboard/storefront-orders")
  }

  return (
    <Card>
      <CardHeader className="bg-muted/50 pb-4">
        <CardTitle>Reject Order</CardTitle>
        <CardDescription>
          Provide a reason for rejecting order <strong>{order.order_name}</strong> from{" "}
          <strong>{order.storefront_customers?.customer_name || "Unknown Customer"}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="rejection-reason" className="block text-sm font-medium">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="rejection-reason"
              placeholder="Please provide a reason for rejecting this order..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full resize-y min-h-[100px]"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t bg-muted/20 py-4">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
          {isSubmitting ? "Rejecting..." : "Reject Order"}
        </Button>
      </CardFooter>
    </Card>
  )
}
