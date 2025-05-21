"use client"

import { useState } from "react"
import Link from "next/link"
import { format, parseISO, isValid } from "date-fns"
import { Eye, Calendar, Truck, MoreHorizontal } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/lib/utils"

interface DeliveryOrder {
  id: string
  order_name: string
  delivery_date: string | null
  status: string
  delivery_time: string | null
  total_order_value?: number | null
  customers: {
    id: string
    customer_name: string
  }
}

interface DeliveriesTableProps {
  orders: DeliveryOrder[]
}

export function DeliveriesTable({ orders }: DeliveriesTableProps) {
  const [sortColumn, setSortColumn] = useState<string>("delivery_date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const sortedOrders = [...orders].sort((a, b) => {
    if (sortColumn === "delivery_date") {
      const dateA = a.delivery_date ? new Date(a.delivery_date).getTime() : 0
      const dateB = b.delivery_date ? new Date(b.delivery_date).getTime() : 0
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA
    } else if (sortColumn === "customer") {
      const customerA = a.customers?.customer_name || ""
      const customerB = b.customers?.customer_name || ""
      return sortDirection === "asc" ? customerA.localeCompare(customerB) : customerB.localeCompare(customerA)
    } else if (sortColumn === "order_name") {
      const nameA = a.order_name || ""
      const nameB = b.order_name || ""
      return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
    }
    return 0
  })

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
    <div className="bg-white rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => handleSort("order_name")}>
              Order Name
              {sortColumn === "order_name" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("customer")}>
              Customer
              {sortColumn === "customer" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("delivery_date")}>
              Delivery Date
              {sortColumn === "delivery_date" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </TableHead>
            <TableHead>Delivery Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Value</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No deliveries found
              </TableCell>
            </TableRow>
          ) : (
            sortedOrders.map((order) => (
              <TableRow key={order.id}>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/customer-orders/${order.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Order Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/customer-orders/${order.id}/edit`}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Reschedule Delivery
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/customer-orders/${order.id}/pdf`}>
                          <Truck className="h-4 w-4 mr-2" />
                          Generate Delivery Note
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
