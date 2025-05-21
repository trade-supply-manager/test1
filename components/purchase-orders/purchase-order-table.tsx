"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { Search, Filter, X, ArrowUpDown, Calendar, DollarSign, AlignLeft, SortDesc, Factory } from "lucide-react"
import { PurchaseOrderActions } from "./purchase-order-actions"
import { PurchaseOrderFilterDialog } from "./purchase-order-filter-dialog"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"

interface Manufacturer {
  id: string
  manufacturer_name: string
}

interface PurchaseOrder {
  id: string
  order_name: string
  status: string
  payment_status: string
  delivery_date: string
  delivery_time: string
  total_order_value: number
  manufacturer_id: string
  date_created: string
  total_items: number
  is_archived: boolean
  manufacturers: {
    manufacturer_name: string
  }
}

interface PurchaseOrderTableProps {
  purchaseOrders: PurchaseOrder[]
  manufacturers: Manufacturer[]
}

type SortOption = {
  label: string
  value: string
  icon: React.ReactNode
  shortLabel?: string // Added short label for display in the trigger
  sortFn: (a: PurchaseOrder, b: PurchaseOrder) => number
}

export function PurchaseOrderTable({ purchaseOrders, manufacturers }: PurchaseOrderTableProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all")
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("all")
  const [showArchived, setShowArchived] = useState(false)
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([])
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [activeFiltersCount, setActiveFiltersCount] = useState(0)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [paginatedOrders, setPaginatedOrders] = useState<PurchaseOrder[]>([])

  // Sorting state
  const [sortOption, setSortOption] = useState<string>("newest-created")

  // Define sort options
  const sortOptions: SortOption[] = [
    {
      label: "Newest First (Date Created)",
      shortLabel: "Newest First",
      value: "newest-created",
      icon: <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => {
        if (!a.date_created) return 1
        if (!b.date_created) return -1
        return new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
      },
    },
    {
      label: "Oldest First (Date Created)",
      shortLabel: "Oldest First",
      value: "oldest-created",
      icon: <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => {
        if (!a.date_created) return 1
        if (!b.date_created) return -1
        return new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
      },
    },
    {
      label: "Newest First (Delivery Date)",
      shortLabel: "Newest Delivery",
      value: "newest-delivery",
      icon: <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => {
        if (!a.delivery_date) return 1
        if (!b.delivery_date) return -1
        return new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime()
      },
    },
    {
      label: "Oldest First (Delivery Date)",
      shortLabel: "Oldest Delivery",
      value: "oldest-delivery",
      icon: <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => {
        if (!a.delivery_date) return 1
        if (!b.delivery_date) return -1
        return new Date(a.delivery_date).getTime() - new Date(a.delivery_date).getTime()
      },
    },
    {
      label: "Manufacturer A-Z",
      shortLabel: "Manufacturer A-Z",
      value: "manufacturer-az",
      icon: <AlignLeft className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => a.manufacturers.manufacturer_name.localeCompare(b.manufacturers.manufacturer_name),
    },
    {
      label: "Manufacturer Z-A",
      shortLabel: "Manufacturer Z-A",
      value: "manufacturer-za",
      icon: <SortDesc className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => b.manufacturers.manufacturer_name.localeCompare(a.manufacturers.manufacturer_name),
    },
    {
      label: "Order Amount (High to Low)",
      shortLabel: "Amount (High-Low)",
      value: "amount-high-low",
      icon: <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => (b.total_order_value || 0) - (a.total_order_value || 0),
    },
    {
      label: "Order Amount (Low to High)",
      shortLabel: "Amount (Low-High)",
      value: "amount-low-high",
      icon: <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => (a.total_order_value || 0) - (b.total_order_value || 0),
    },
  ]

  // Get current sort option
  const getCurrentSortOption = () => {
    return sortOptions.find((option) => option.value === sortOption) || sortOptions[0]
  }

  // Get manufacturer name by ID
  const getManufacturerName = (id: string) => {
    const manufacturer = manufacturers.find((m) => m.id === id)
    return manufacturer ? manufacturer.manufacturer_name : "Unknown Manufacturer"
  }

  // Calculate active filters count
  useEffect(() => {
    let count = 0
    if (statusFilter !== "all") count++
    if (paymentStatusFilter !== "all") count++
    if (manufacturerFilter !== "all") count++
    if (showArchived) count++
    setActiveFiltersCount(count)
  }, [statusFilter, paymentStatusFilter, manufacturerFilter, showArchived])

  // Update filtered orders when filters or purchaseOrders change
  useEffect(() => {
    let filtered = purchaseOrders.filter((order) => {
      // Filter by archived status
      const matchesArchiveStatus = showArchived ? order.is_archived : !order.is_archived

      const matchesSearch =
        order.order_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.manufacturers.manufacturer_name.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === "all" || order.status === statusFilter
      const matchesPaymentStatus = paymentStatusFilter === "all" || order.payment_status === paymentStatusFilter
      const matchesManufacturer = manufacturerFilter === "all" || order.manufacturer_id === manufacturerFilter

      return matchesSearch && matchesStatus && matchesPaymentStatus && matchesManufacturer && matchesArchiveStatus
    })

    // Apply sorting
    const currentSortOption = getCurrentSortOption()
    filtered = [...filtered].sort(currentSortOption.sortFn)

    setFilteredOrders(filtered)

    // Reset to first page when filters change
    setCurrentPage(1)

    // Calculate total pages
    setTotalPages(Math.max(1, Math.ceil(filtered.length / itemsPerPage)))
  }, [
    searchTerm,
    statusFilter,
    paymentStatusFilter,
    manufacturerFilter,
    purchaseOrders,
    itemsPerPage,
    showArchived,
    sortOption,
  ])

  // Update paginated orders when filtered orders or pagination settings change
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    setPaginatedOrders(filteredOrders.slice(startIndex, endIndex))
  }, [filteredOrders, currentPage, itemsPerPage])

  // Helper function to format time from 24h to 12h format
  function formatTime(time: string): string {
    // Handle cases where time might be in different formats
    if (!time) return ""

    let hours: number
    let minutes: string

    // Check if time is in HH:MM format
    if (time.includes(":")) {
      const [hoursStr, minutesStr] = time.split(":")
      hours = Number.parseInt(hoursStr, 10)
      minutes = minutesStr.substring(0, 2) // Take only the first 2 characters in case there are seconds
    } else {
      // Try to handle other formats or return the original
      return time
    }

    const ampm = hours >= 12 ? "PM" : "AM"
    hours = hours % 12
    hours = hours ? hours : 12 // Convert 0 to 12

    return `${hours}:${minutes} ${ampm}`
  }

  // Handle archive callback
  const handleArchive = (id: string) => {
    // Remove the archived order from the local state if we're not showing archived orders
    if (!showArchived) {
      setFilteredOrders(filteredOrders.filter((order) => order.id !== id))
    } else {
      // If we're showing archived orders, update the is_archived status in the local state
      setFilteredOrders(filteredOrders.map((order) => (order.id === id ? { ...order, is_archived: true } : order)))
    }
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  // Reset all filters
  const handleResetFilters = () => {
    setStatusFilter("all")
    setPaymentStatusFilter("all")
    setManufacturerFilter("all")
    setShowArchived(false)
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxPagesToShow = 5

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total pages is less than max pages to show
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      // Always show first page
      pageNumbers.push(1)

      // Calculate start and end of middle pages
      let startPage = Math.max(2, currentPage - 1)
      let endPage = Math.min(totalPages - 1, currentPage + 1)

      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        endPage = 4
      }

      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        startPage = totalPages - 3
      }

      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pageNumbers.push("ellipsis-start")
      }

      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i)
      }

      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push("ellipsis-end")
      }

      // Always show last page
      pageNumbers.push(totalPages)
    }

    return pageNumbers
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Search bar - takes less space on larger screens */}
        <div className="relative lg:col-span-5">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search orders or manufacturers..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Controls container - more space for controls */}
        <div className="flex flex-wrap lg:col-span-7 gap-2 items-center justify-end">
          <Button variant="outline" onClick={() => setFilterDialogOpen(true)} className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {/* Sort By Dropdown - wider to accommodate longer labels */}
          <div className="flex items-center">
            <Select value={sortOption} onValueChange={setSortOption}>
              <SelectTrigger className="w-[180px] md:w-[220px]">
                <div className="flex items-center whitespace-nowrap">
                  <ArrowUpDown className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline-block mr-1 text-gray-500">Sort:</span>
                  <span className="truncate">
                    {getCurrentSortOption().shortLabel || getCurrentSortOption().label.split("(")[0].trim()}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="min-w-[280px] max-h-[300px]">
                <div className="p-1 border-b border-gray-100">
                  <h4 className="text-xs font-medium text-gray-500 px-2">Date</h4>
                </div>
                {sortOptions.slice(0, 4).map((option) => (
                  <SelectItem key={option.value} value={option.value} className="flex items-center whitespace-nowrap">
                    <div className="flex items-center">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}

                <div className="p-1 border-b border-t border-gray-100 mt-1">
                  <h4 className="text-xs font-medium text-gray-500 px-2">Manufacturer</h4>
                </div>
                {sortOptions.slice(4, 6).map((option) => (
                  <SelectItem key={option.value} value={option.value} className="flex items-center whitespace-nowrap">
                    <div className="flex items-center">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}

                <div className="p-1 border-b border-t border-gray-100 mt-1">
                  <h4 className="text-xs font-medium text-gray-500 px-2">Amount</h4>
                </div>
                {sortOptions.slice(6).map((option) => (
                  <SelectItem key={option.value} value={option.value} className="flex items-center whitespace-nowrap">
                    <div className="flex items-center">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number.parseInt(value))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Items per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 per page</SelectItem>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter Dialog */}
      <PurchaseOrderFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        statusFilter={statusFilter}
        paymentStatusFilter={paymentStatusFilter}
        manufacturerFilter={manufacturerFilter}
        showArchived={showArchived}
        manufacturers={manufacturers}
        onStatusFilterChange={setStatusFilter}
        onPaymentStatusFilterChange={setPaymentStatusFilter}
        onManufacturerFilterChange={setManufacturerFilter}
        onShowArchivedChange={setShowArchived}
        onReset={handleResetFilters}
        onApply={() => {}}
      />

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {statusFilter !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              Status: {statusFilter}
              <button
                onClick={() => setStatusFilter("all")}
                className="ml-1 hover:bg-gray-100 rounded-full p-0.5"
                aria-label="Clear status filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {paymentStatusFilter !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              Payment: {paymentStatusFilter}
              <button
                onClick={() => setPaymentStatusFilter("all")}
                className="ml-1 hover:bg-gray-100 rounded-full p-0.5"
                aria-label="Clear payment status filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {manufacturerFilter !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Factory className="h-3 w-3 mr-1" />
              Manufacturer: {getManufacturerName(manufacturerFilter)}
              <button
                onClick={() => setManufacturerFilter("all")}
                className="ml-1 hover:bg-gray-100 rounded-full p-0.5"
                aria-label="Clear manufacturer filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {showArchived && (
            <Badge variant="outline" className="flex items-center gap-1">
              Including Archived
              <button
                onClick={() => setShowArchived(false)}
                className="ml-1 hover:bg-gray-100 rounded-full p-0.5"
                aria-label="Clear archived filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {activeFiltersCount > 1 && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-7 px-2 text-xs">
              Clear All
            </Button>
          )}
        </div>
      )}

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Name</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Date Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Total Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  {showArchived ? "No archived purchase orders found" : "No purchase orders found"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => (
                <TableRow key={order.id} className={order.is_archived ? "bg-gray-50" : ""}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/purchase-orders/${order.id}`} className="hover:underline">
                      {order.order_name}
                    </Link>
                    {order.is_archived && (
                      <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Archived</span>
                    )}
                  </TableCell>
                  <TableCell>{order.manufacturers.manufacturer_name}</TableCell>
                  <TableCell>
                    {order.date_created ? format(new Date(order.date_created), "MMM d, yyyy") : "Unknown"}
                  </TableCell>
                  <TableCell>
                    <div
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : order.status === "Processing"
                            ? "bg-blue-100 text-blue-800"
                            : order.status === "Cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {order.status}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.payment_status === "Paid"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {order.payment_status}
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.delivery_date
                      ? format(new Date(order.delivery_date), "MMM d, yyyy") +
                        (order.delivery_time ? ` at ${formatTime(order.delivery_time)}` : "")
                      : "Not scheduled"}
                  </TableCell>
                  <TableCell>{order.total_items || 0}</TableCell>
                  <TableCell>{formatCurrency(order.total_order_value || 0)}</TableCell>
                  <TableCell className="text-right">
                    <PurchaseOrderActions
                      purchaseOrderId={order.id}
                      onArchive={() => handleArchive(order.id)}
                      isArchived={order.is_archived}
                      useGearIcon={true}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {filteredOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 order-2 sm:order-1">
            Showing {paginatedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} entries
            {showArchived ? " (including archived)" : ""}
          </div>

          <Pagination className="order-1 sm:order-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {getPageNumbers().map((page, index) =>
                page === "ellipsis-start" || page === "ellipsis-end" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={`page-${page}`}>
                    <PaginationLink isActive={currentPage === page} onClick={() => handlePageChange(page as number)}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
