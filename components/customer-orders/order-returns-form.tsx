"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Predefined return reasons
const RETURN_REASONS = [
  { value: "damaged", label: "Damaged Item" },
  { value: "incorrect", label: "Incorrect Item Received" },
  { value: "defective", label: "Defective Product" },
  { value: "size_issue", label: "Size Issue" },
  { value: "color_mismatch", label: "Color Mismatch" },
  { value: "quality_issue", label: "Quality Not as Expected" },
  { value: "no_longer_needed", label: "No Longer Needed" },
  { value: "customer_changed_mind", label: "Customer Changed Mind" },
  { value: "other", label: "Other (Please Specify)" },
]

interface OrderItem {
  id: string
  product_name: string
  variant_name: string
  quantity: number
  unit_price: number
  total_order_item_value: number
  unit: string | null
}

interface OrderReturnsFormProps {
  orderId: string
  orderName: string
  orderItems: OrderItem[]
  customerName: string
  userId: string
}

export function OrderReturnsForm({ orderId, orderName, orderItems, customerName, userId }: OrderReturnsFormProps) {
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})
  const [selectedReasonCode, setSelectedReasonCode] = useState<string>("")
  const [customReason, setCustomReason] = useState<string>("")
  const [returnNotes, setReturnNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newState = { ...prev, [itemId]: !prev[itemId] }

      // Initialize return quantity if item is selected
      if (newState[itemId] && !returnQuantities[itemId]) {
        const item = orderItems.find((item) => item.id === itemId)
        if (item) {
          setReturnQuantities((prev) => ({
            ...prev,
            [itemId]: item.quantity,
          }))
        }
      }

      return newState
    })
  }

  // Update return quantity
  const updateReturnQuantity = (itemId: string, quantity: number) => {
    const item = orderItems.find((item) => item.id === itemId)
    if (!item) return

    // Ensure quantity is not negative and not more than the original quantity
    const validQuantity = Math.min(Math.max(0, quantity), item.quantity)

    setReturnQuantities((prev) => ({
      ...prev,
      [itemId]: validQuantity,
    }))
  }

  // Calculate total refund amount
  const calculateTotalRefund = () => {
    return orderItems.reduce((total, item) => {
      if (selectedItems[item.id] && returnQuantities[item.id]) {
        return total + item.unit_price * returnQuantities[item.id]
      }
      return total
    }, 0)
  }

  // Get the full return reason text (either predefined or custom)
  const getFullReturnReason = () => {
    if (selectedReasonCode === "other") {
      return customReason.trim() ? customReason : "Other"
    }

    const selectedReason = RETURN_REASONS.find((reason) => reason.value === selectedReasonCode)
    return selectedReason ? selectedReason.label : ""
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (Object.keys(selectedItems).filter((id) => selectedItems[id]).length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to return.",
        variant: "destructive",
      })
      return
    }

    if (!selectedReasonCode) {
      toast({
        title: "Return reason required",
        description: "Please select a reason for the return.",
        variant: "destructive",
      })
      return
    }

    if (selectedReasonCode === "other" && !customReason.trim()) {
      toast({
        title: "Custom reason required",
        description: "Please provide a reason for the return.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Get the full return reason text
      const fullReturnReason = getFullReturnReason()

      // 1. Create the return record
      const totalRefundAmount = calculateTotalRefund()
      const returnId = crypto.randomUUID()
      const timestamp = new Date().toISOString()

      const { error: returnError } = await supabase.from("customer_order_returns").insert({
        id: returnId,
        customer_order_id: orderId,
        // Remove employee_id field and use updated_by_user_id instead
        updated_by_user_id: userId,
        return_reason: fullReturnReason,
        return_notes: returnNotes,
        status: "Pending",
        refund_status: "Pending",
        total_refund_amount: totalRefundAmount,
        is_archived: false,
        date_created: timestamp,
        date_last_updated: timestamp,
      })

      if (returnError) throw returnError

      // 2. Create return items
      const returnItems = orderItems
        .filter((item) => selectedItems[item.id])
        .map((item) => ({
          id: crypto.randomUUID(),
          customer_order_item_id: item.id,
          quantity_returned: returnQuantities[item.id] || 0,
          unit_price: item.unit_price,
          refund_amount: (returnQuantities[item.id] || 0) * item.unit_price,
          created_by_user_id: userId,
          updated_by_user_id: userId,
          return_reason: fullReturnReason,
          notes: returnNotes,
          date_created: timestamp,
          date_last_updated: timestamp,
        }))

      const { error: itemsError } = await supabase.from("customer_order_return_items").insert(returnItems)

      if (itemsError) throw itemsError

      toast({
        title: "Return processed successfully",
        description: "The return has been recorded and is pending approval.",
      })

      // Redirect back to the order details page
      router.push(`/dashboard/customer-orders/${orderId}`)
      router.refresh()
    } catch (error: any) {
      console.error("Error processing return:", error)
      toast({
        title: "Error processing return",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
            <CardDescription>Review the order details before processing the return</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Order Name</Label>
                <p className="text-sm font-medium">{orderName}</p>
              </div>
              <div>
                <Label>Customer</Label>
                <p className="text-sm font-medium">{customerName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Select Items to Return</CardTitle>
            <CardDescription>Check the items you want to return and specify the quantity</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                Returned items will be added back to inventory. Make sure the items are in good condition before
                processing the return.
              </AlertDescription>
            </Alert>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Original Qty</TableHead>
                  <TableHead className="text-right">Return Qty</TableHead>
                  <TableHead className="text-right">Refund Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4">
                      No items found in this order
                    </TableCell>
                  </TableRow>
                ) : (
                  orderItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems[item.id] || false}
                          onCheckedChange={() => toggleItemSelection(item.id)}
                        />
                      </TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.variant_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={returnQuantities[item.id] || 0}
                          onChange={(e) => updateReturnQuantity(item.id, Number.parseFloat(e.target.value))}
                          disabled={!selectedItems[item.id]}
                          className="w-20 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {selectedItems[item.id] && returnQuantities[item.id]
                          ? formatCurrency(item.unit_price * returnQuantities[item.id])
                          : formatCurrency(0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div>
              <p className="text-sm font-medium">Total Refund Amount</p>
              <p className="text-2xl font-bold">{formatCurrency(calculateTotalRefund())}</p>
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Return Details</CardTitle>
            <CardDescription>Provide information about the reason for the return</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="returnReason">Return Reason</Label>
              <Select value={selectedReasonCode} onValueChange={setSelectedReasonCode} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason for the return" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Common Reasons</SelectLabel>
                    {RETURN_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {selectedReasonCode === "other" && (
              <div className="space-y-2">
                <Label htmlFor="customReason">Please Specify</Label>
                <Textarea
                  id="customReason"
                  placeholder="Enter the specific reason for the return"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="returnNotes">Additional Notes</Label>
              <Textarea
                id="returnNotes"
                placeholder="Any additional information about this return"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Process Return"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </form>
  )
}
