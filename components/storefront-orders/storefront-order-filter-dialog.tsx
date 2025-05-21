"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Archive } from "lucide-react"

interface StorefrontOrderFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  statusFilter: string
  paymentStatusFilter: string
  showArchived: boolean
  onStatusFilterChange: (value: string) => void
  onPaymentStatusFilterChange: (value: string) => void
  onShowArchivedChange: (value: boolean) => void
  onReset: () => void
  onApply: () => void
}

export function StorefrontOrderFilterDialog({
  open,
  onOpenChange,
  statusFilter,
  paymentStatusFilter,
  showArchived,
  onStatusFilterChange,
  onPaymentStatusFilterChange,
  onShowArchivedChange,
  onReset,
  onApply,
}: StorefrontOrderFilterDialogProps) {
  // Local state to track changes before applying
  const [localStatusFilter, setLocalStatusFilter] = useState(statusFilter)
  const [localPaymentStatusFilter, setLocalPaymentStatusFilter] = useState(paymentStatusFilter)
  const [localShowArchived, setLocalShowArchived] = useState(showArchived)

  // Update local state when props change
  useEffect(() => {
    setLocalStatusFilter(statusFilter)
    setLocalPaymentStatusFilter(paymentStatusFilter)
    setLocalShowArchived(showArchived)
  }, [statusFilter, paymentStatusFilter, showArchived, open])

  // Handle apply button click
  const handleApply = () => {
    onStatusFilterChange(localStatusFilter)
    onPaymentStatusFilterChange(localPaymentStatusFilter)
    onShowArchivedChange(localShowArchived)
    onApply()
    onOpenChange(false)
  }

  // Handle reset button click
  const handleReset = () => {
    setLocalStatusFilter("all")
    setLocalPaymentStatusFilter("all")
    setLocalShowArchived(false)
    onReset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filter Storefront Orders</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="status-filter">Order Status</Label>
            <Select value={localStatusFilter} onValueChange={setLocalStatusFilter}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-filter">Payment Status</Label>
            <Select value={localPaymentStatusFilter} onValueChange={setLocalPaymentStatusFilter}>
              <SelectTrigger id="payment-filter">
                <SelectValue placeholder="Filter by payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Statuses</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-archived"
              checked={localShowArchived}
              onCheckedChange={setLocalShowArchived}
              aria-label="Show archived storefront orders"
            />
            <Label htmlFor="show-archived" className="flex items-center cursor-pointer">
              <Archive className="h-4 w-4 mr-1" />
              Show Archived Orders
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
