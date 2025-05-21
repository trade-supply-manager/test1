"use client"

import type React from "react"

import { useState } from "react"
import { format, parseISO, isValid } from "date-fns"
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency } from "@/lib/utils"
import Link from "next/link"

interface DeliveryOrder {
  id: string
  order_name: string
  delivery_date: string | null
  status: string
  delivery_time: string | null
  total_order_value?: number | null
  delivery_address?: string | null
  delivery_method?: string | null
  delivery_instructions?: string | null
  customers: {
    id: string
    customer_name: string
  }
}

interface ConflictGroupProps {
  title: string
  description: string
  orders: DeliveryOrder[]
  icon?: React.ReactNode
  defaultOpen?: boolean
}

export function ConflictGroup({ title, description, orders, icon, defaultOpen = false }: ConflictGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not scheduled"
    try {
      const date = parseISO(dateString)
      if (!isValid(date)) return "Invalid date"
      return format(date, "MMM d, yyyy")
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Invalid date"
    }
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "Not specified"
    return timeString
  }

  // Function to get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="border rounded-md overflow-hidden bg-white mb-4">
      <div
        className={cn("flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50", isOpen && "border-b")}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
            {icon || <AlertTriangle className="h-4 w-4 text-red-600" />}
          </div>
          <div>
            <h3 className="font-medium text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Delivery Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="bg-red-50">
                  <TableCell className="font-medium">{order.order_name}</TableCell>
                  <TableCell>{order.customers?.customer_name}</TableCell>
                  <TableCell>{formatDate(order.delivery_date)}</TableCell>
                  <TableCell>{formatTime(order.delivery_time)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {order.total_order_value ? formatCurrency(order.total_order_value) : "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/customer-orders/${order.id}/edit`}>
                      <Button variant="outline" size="sm">
                        Reschedule
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
