"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Eye,
  Edit,
  Archive,
  RotateCcw,
  FileText,
  Filter,
  ArrowUpDown,
  X,
  Calendar,
  AlignLeft,
  SortDesc,
  Users,
  DollarSign,
  Settings,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { CustomerOrderFilterDialog } from "./customer-order-filter-dialog"

interface CustomerOrder {
  id: string
  order_name: string
  date_created: string
  delivery_date: string
  status: string
  payment_status: string | null
  total_order_value: number | null
  is_archived: boolean | null
  customers: {
    customer_name: string
    id: string
  }
}

interface CustomerOrderTableProps {
  orders: CustomerOrder[]
}

type SortOption = {
  label: string
  value: string
  icon: React.ReactNode
  shortLabel?: string
  sortFn: (a: CustomerOrder, b: CustomerOrder) => number
}

export function CustomerOrderTable({ orders }: CustomerOrderTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [sortOption, setSortOption] = useState("newest-created")
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFiltersCount, setActiveFiltersCount] = useState(0)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

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
      label: "Order Name A-Z",
      shortLabel: "Name A-Z",
      value: "name-az",
      icon: <AlignLeft className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => a.order_name.localeCompare(b.order_name),
    },
    {
      label: "Order Name Z-A",
      shortLabel: "Name Z-A",
      value: "name-za",
      icon: <SortDesc className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => b.order_name.localeCompare(a.order_name),
    },
    {
      label: "Customer A-Z",
      shortLabel: "Customer A-Z",
      value: "customer-az",
      icon: <Users className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => a.customers.customer_name.localeCompare(b.customers.customer_name),
    },
    {
      label: "Customer Z-A",
      shortLabel: "Customer Z-A",
      value: "customer-za",
      icon: <Users className="h-4 w-4 mr-2 flex-shrink-0" />,
      sortFn: (a, b) => b.customers.customer_name.localeCompare(a.customers.customer_name),
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

  // Filter orders based on search, status, payment status, and archive filters
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customers.customer_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || order.status === statusFilter

    const matchesPaymentStatus = paymentStatusFilter === "all" || order.payment_status === paymentStatusFilter

    const matchesArchiveFilter = showArchived ? true : !order.is_archived

    return matchesSearch && matchesStatus && matchesPaymentStatus && matchesArchiveFilter
  })

  // Sort filtered orders using the sort function from the selected option
  const sortedOrders = [...filteredOrders].sort(getCurrentSortOption().sortFn)

  // Paginate orders
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage)

  // Calculate active filters count
  useEffect(() => {
    let count = 0
    if (statusFilter !== "all") count++
    if (paymentStatusFilter !== "all") count++
    if (showArchived) count++
    setActiveFiltersCount(count)
  }, [statusFilter, paymentStatusFilter, showArchived])

  // Reset filters to default values
  const handleResetFilters = () => {
    setStatusFilter("all")
    setPaymentStatusFilter("all")
    setShowArchived(false)
  }

  // Apply filters (placeholder for any additional logic needed when applying filters)
  const handleApplyFilters = () => {
    // Reset to first page when filters change
    setCurrentPage(1)
  }

  const toggleArchiveStatus = async (id: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from("customer_orders")
        .update({
          is_archived: !currentStatus,
          date_last_updated: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) throw error

      toast({
        title: currentStatus ? "Order restored" : "Order archived",
        description: currentStatus
          ? "The order has been restored successfully."
          : "The order has been archived successfully.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while updating the order",
      })
    }
  }

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

  const getPaymentStatusBadgeClass = (status: string | null) => {
    if (!status) return "bg-gray-100 text-gray-800"

    switch (status.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "partial":
        return "bg-blue-100 text-blue-800"
      case "unpaid":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
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
            type="search"
            placeholder="Search orders or customers..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Controls container - more space for controls */}
        <div className="flex flex-wrap lg:col-span-7 gap-2 items-center justify-end">
          <Button variant="outline" className="flex items-center gap-2" onClick={() => setFilterDialogOpen(true)}>
            <Filter className="h-4 w-4" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {/* Sort By Dropdown - Matching Purchase Orders styling */}
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
                  <h4 className="text-xs font-medium text-gray-500 px-2">Order</h4>
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
                  <h4 className="text-xs font-medium text-gray-500 px-2">Customer</h4>
                </div>
                {sortOptions.slice(6, 8).map((option) => (
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
                {sortOptions.slice(8).map((option) => (
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

          <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
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
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden md:table-cell">Delivery Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Payment</TableHead>
              <TableHead className="hidden lg:table-cell">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => (
                <TableRow key={order.id} className={order.is_archived ? "bg-muted/50" : ""}>
                  <TableCell className="font-medium">
                    {order.order_name}
                    {order.is_archived && <span className="ml-2 text-xs text-muted-foreground">(Archived)</span>}
                  </TableCell>
                  <TableCell>{order.customers.customer_name}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(order.date_created)}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(order.delivery_date)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusBadgeClass(order.payment_status)}`}
                    >
                      {order.payment_status || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{formatCurrency(order.total_order_value)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings className="h-4 w-4 text-black" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/customer-orders/${order.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/customer-orders/${order.id}/edit`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/customer-orders/${order.id}/pdf`}>
                            <FileText className="h-4 w-4 mr-2" />
                            Invoice
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/customer-orders/${order.id}/returns`}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Returns
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleArchiveStatus(order.id, order.is_archived)}>
                          {order.is_archived ? (
                            <>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restore
                            </>
                          ) : (
                            <>
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </>
                          )}
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

      {/* Pagination controls */}
      {sortedOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 order-2 sm:order-1">
            Showing {paginatedOrders.length > 0 ? startIndex + 1 : 0} to{" "}
            {Math.min(startIndex + itemsPerPage, sortedOrders.length)} of {sortedOrders.length} entries
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

      {/* Filter Dialog */}
      <CustomerOrderFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        statusFilter={statusFilter}
        paymentStatusFilter={paymentStatusFilter}
        showArchived={showArchived}
        onStatusFilterChange={setStatusFilter}
        onPaymentStatusFilterChange={setPaymentStatusFilter}
        onShowArchivedChange={setShowArchived}
        onReset={handleResetFilters}
        onApply={handleApplyFilters}
      />
    </div>
  )
}
