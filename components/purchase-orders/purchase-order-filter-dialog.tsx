"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Archive, Search } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"

interface Manufacturer {
  id: string
  manufacturer_name: string
}

interface PurchaseOrderFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  statusFilter: string
  paymentStatusFilter: string
  manufacturerFilter: string
  showArchived: boolean
  manufacturers: Manufacturer[]
  onStatusFilterChange: (value: string) => void
  onPaymentStatusFilterChange: (value: string) => void
  onManufacturerFilterChange: (value: string) => void
  onShowArchivedChange: (value: boolean) => void
  onReset: () => void
  onApply: () => void
}

export function PurchaseOrderFilterDialog({
  open,
  onOpenChange,
  statusFilter,
  paymentStatusFilter,
  manufacturerFilter,
  showArchived,
  manufacturers,
  onStatusFilterChange,
  onPaymentStatusFilterChange,
  onManufacturerFilterChange,
  onShowArchivedChange,
  onReset,
  onApply,
}: PurchaseOrderFilterDialogProps) {
  // Local state to track changes before applying
  const [localStatusFilter, setLocalStatusFilter] = useState(statusFilter)
  const [localPaymentStatusFilter, setLocalPaymentStatusFilter] = useState(paymentStatusFilter)
  const [localManufacturerFilter, setLocalManufacturerFilter] = useState(manufacturerFilter)
  const [localShowArchived, setLocalShowArchived] = useState(showArchived)
  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState("")

  // Update local state when props change
  useEffect(() => {
    setLocalStatusFilter(statusFilter)
    setLocalPaymentStatusFilter(paymentStatusFilter)
    setLocalManufacturerFilter(manufacturerFilter)
    setLocalShowArchived(showArchived)
    setManufacturerSearchTerm("")
  }, [statusFilter, paymentStatusFilter, manufacturerFilter, showArchived, open])

  // Filter manufacturers based on search term
  const filteredManufacturers = manufacturers.filter((manufacturer) =>
    manufacturer.manufacturer_name.toLowerCase().includes(manufacturerSearchTerm.toLowerCase()),
  )

  // Handle apply button click
  const handleApply = () => {
    onStatusFilterChange(localStatusFilter)
    onPaymentStatusFilterChange(localPaymentStatusFilter)
    onManufacturerFilterChange(localManufacturerFilter)
    onShowArchivedChange(localShowArchived)
    onApply()
    onOpenChange(false)
  }

  // Handle reset button click
  const handleReset = () => {
    setLocalStatusFilter("all")
    setLocalPaymentStatusFilter("all")
    setLocalManufacturerFilter("all")
    setLocalShowArchived(false)
    onReset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filter Purchase Orders</DialogTitle>
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
                <SelectItem value="Processing">Processing</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
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
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manufacturer-filter">Manufacturer</Label>
            <Select value={localManufacturerFilter} onValueChange={setLocalManufacturerFilter}>
              <SelectTrigger id="manufacturer-filter">
                <SelectValue placeholder="Filter by manufacturer" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search manufacturers..."
                      className="pl-8"
                      value={manufacturerSearchTerm}
                      onChange={(e) => setManufacturerSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <ScrollArea className="h-[200px]">
                  <SelectItem value="all">All Manufacturers</SelectItem>
                  {filteredManufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer.id} value={manufacturer.id}>
                      {manufacturer.manufacturer_name}
                    </SelectItem>
                  ))}
                  {filteredManufacturers.length === 0 && (
                    <div className="py-2 px-2 text-sm text-gray-500 text-center">No manufacturers found</div>
                  )}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-archived"
              checked={localShowArchived}
              onCheckedChange={setLocalShowArchived}
              aria-label="Show archived purchase orders"
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
