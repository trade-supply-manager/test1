"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDate, formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Search, Eye, Edit, Archive, RotateCcw, Settings } from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface Manufacturer {
  id: string
  manufacturer_name: string
  email: string | null
  phone_number: string | null
  address: string | null
  cost_per_pallet: number | null
  date_created: string
  is_archived: boolean | null
}

interface ManufacturerTableProps {
  manufacturers: Manufacturer[]
}

export function ManufacturerTable({ manufacturers }: ManufacturerTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const manufacturersPerPage = 10
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const filteredManufacturers = manufacturers.filter((manufacturer) => {
    const matchesSearch =
      manufacturer.manufacturer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (manufacturer.email && manufacturer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (manufacturer.phone_number && manufacturer.phone_number.includes(searchTerm))

    const matchesArchiveFilter = showArchived ? true : !manufacturer.is_archived

    return matchesSearch && matchesArchiveFilter
  })

  // Reset to first page when search term or archive filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, showArchived])

  // Calculate pagination values
  const totalManufacturers = filteredManufacturers.length
  const totalPages = Math.ceil(totalManufacturers / manufacturersPerPage)
  const startIndex = (currentPage - 1) * manufacturersPerPage
  const endIndex = Math.min(startIndex + manufacturersPerPage, totalManufacturers)
  const paginatedManufacturers = filteredManufacturers.slice(startIndex, endIndex)

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

  const toggleArchiveStatus = async (id: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from("manufacturers")
        .update({
          is_archived: !currentStatus,
          date_last_updated: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) throw error

      toast({
        title: currentStatus ? "Manufacturer restored" : "Manufacturer archived",
        description: currentStatus
          ? "The manufacturer has been restored successfully."
          : "The manufacturer has been archived successfully.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while updating the manufacturer",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search manufacturers..."
            className="pl-8 w-full sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Manufacturer Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Cost Per Pallet</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedManufacturers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No manufacturers found
                </TableCell>
              </TableRow>
            ) : (
              paginatedManufacturers.map((manufacturer) => (
                <TableRow key={manufacturer.id} className={manufacturer.is_archived ? "bg-muted/50" : ""}>
                  <TableCell className="font-medium">
                    {manufacturer.manufacturer_name}
                    {manufacturer.is_archived && <span className="ml-2 text-xs text-muted-foreground">(Archived)</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{manufacturer.email || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell">{manufacturer.phone_number || "-"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {manufacturer.cost_per_pallet ? formatCurrency(manufacturer.cost_per_pallet) : "-"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{formatDate(manufacturer.date_created)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Settings className="h-4 w-4 text-black" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/manufacturers/${manufacturer.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/manufacturers/${manufacturer.id}/edit`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleArchiveStatus(manufacturer.id, manufacturer.is_archived)}
                        >
                          {manufacturer.is_archived ? (
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

      {/* Pagination */}
      {filteredManufacturers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 order-2 sm:order-1">
            Showing {startIndex + 1} to {endIndex} of {totalManufacturers} manufacturers
            {showArchived ? " (including archived)" : ""}
          </div>

          <Pagination className="order-1 sm:order-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {getPageNumbers().map((page, index) =>
                page === "ellipsis-start" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : page === "ellipsis-end" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={`page-${page}`}>
                    <PaginationLink
                      isActive={currentPage === page}
                      onClick={() => setCurrentPage(Number(page))}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
