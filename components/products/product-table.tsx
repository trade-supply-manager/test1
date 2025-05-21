"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ChevronDown, ChevronRight, Search, Edit, Archive, RotateCcw, Settings } from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface ProductVariant {
  id: string
  product_id: string
  product_variant_name: string
  product_variant_sku: string
  product_variant_image: string | null
  colour: string | null
  quantity: number | null
  unit_price: number | null
  pallets: number | null
  layers: number | null
  is_archived: boolean | null
}

interface Product {
  id: string
  product_name: string
  product_category: string
  unit: string | null
  feet_per_layer: number | null
  layers_per_pallet: number | null
  date_created: string
  date_last_updated: string
  is_archived: boolean | null
  manufacturers: {
    manufacturer_name: string
  }
  product_variants: ProductVariant[]
}

interface ProductTableProps {
  products: Product[]
}

export function ProductTable({ products }: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const productsPerPage = 10 // You can adjust this value

  // Get unique categories for filter
  const categories = [...new Set(products.map((product) => product.product_category))]

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.manufacturers.manufacturer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.product_category.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === "all" || product.product_category === categoryFilter

    const matchesArchiveFilter = showArchived ? true : !product.is_archived

    return matchesSearch && matchesCategory && matchesArchiveFilter
  })

  // Reset to first page when filters change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value)
    setCurrentPage(1)
  }

  const handleArchivedChange = () => {
    setShowArchived(!showArchived)
    setCurrentPage(1)
  }

  // Pagination calculation
  const indexOfLastProduct = currentPage * productsPerPage
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct)

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage)

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxPagesToShow = 5

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total pages are less than max pages to show
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

  const toggleExpandProduct = (productId: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }))
  }

  const toggleArchiveStatus = async (id: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({
          is_archived: !currentStatus,
          date_last_updated: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) throw error

      toast({
        title: currentStatus ? "Product restored" : "Product archived",
        description: currentStatus
          ? "The product has been restored successfully."
          : "The product has been archived successfully.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while updating the product",
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
            placeholder="Search products..."
            className="pl-8 w-full sm:w-[300px]"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleArchivedChange}>
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit & Metrics</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              currentProducts.map((product) => (
                <>
                  <TableRow key={product.id} className={product.is_archived ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => toggleExpandProduct(product.id)}>
                        {expandedProducts[product.id] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>{product.manufacturers.manufacturer_name}</TableCell>
                    <TableCell className="font-medium">
                      {product.product_name}
                      {product.is_archived && <span className="ml-2 text-xs text-muted-foreground">(Archived)</span>}
                    </TableCell>
                    <TableCell>{product.product_category}</TableCell>
                    <TableCell>
                      <div>
                        <span>{product.unit || "-"}</span>
                        {/* Only show metrics section if at least one metric has a non-zero value */}
                        {(product.feet_per_layer !== null && product.feet_per_layer !== 0) ||
                        (product.layers_per_pallet !== null && product.layers_per_pallet !== 0) ? (
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {product.feet_per_layer !== null && product.feet_per_layer !== 0 && (
                              <div>
                                <span className="font-medium">Feet per Layer:</span> {product.feet_per_layer}
                              </div>
                            )}
                            {product.layers_per_pallet !== null && product.layers_per_pallet !== 0 && (
                              <div>
                                <span className="font-medium">Layers per Pallet:</span> {product.layers_per_pallet}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(product.date_created)}</TableCell>
                    <TableCell>{formatDate(product.date_last_updated)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4 text-black" />
                            <span className="sr-only">Actions menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/products/${product.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleArchiveStatus(product.id, product.is_archived)}>
                            {product.is_archived ? (
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

                  {/* Expandable product variants section */}
                  {expandedProducts[product.id] && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={8} className="p-0">
                        <div className="pl-12 pr-4 py-4">
                          <h4 className="font-medium mb-2">Product Variants</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">Image</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Color</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Unit Price</TableHead>
                                <TableHead>Total Value</TableHead>
                                <TableHead>Pallets</TableHead>
                                <TableHead>Layers</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {product.product_variants.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                                    No variants found
                                  </TableCell>
                                </TableRow>
                              ) : (
                                product.product_variants.map((variant) => (
                                  <TableRow key={variant.id} className={variant.is_archived ? "bg-muted/50" : ""}>
                                    <TableCell>
                                      {variant.product_variant_image ? (
                                        <Image
                                          src={variant.product_variant_image || "/placeholder.svg"}
                                          alt={variant.product_variant_name}
                                          width={40}
                                          height={40}
                                          className="object-cover rounded-md"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                                          No img
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {variant.product_variant_name}
                                      {variant.is_archived && (
                                        <span className="ml-2 text-xs text-muted-foreground">(Archived)</span>
                                      )}
                                    </TableCell>
                                    <TableCell>{variant.product_variant_sku}</TableCell>
                                    <TableCell>{variant.colour || "-"}</TableCell>
                                    <TableCell>{variant.quantity || 0}</TableCell>
                                    <TableCell>{formatCurrency(variant.unit_price || 0)}</TableCell>
                                    <TableCell>
                                      {formatCurrency((variant.quantity || 0) * (variant.unit_price || 0))}
                                    </TableCell>
                                    <TableCell>{variant.pallets || "-"}</TableCell>
                                    <TableCell>{variant.layers || "-"}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Enhanced Pagination */}
      {filteredProducts.length > 0 && (
        <div className="space-y-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) setCurrentPage(currentPage - 1)
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {getPageNumbers().map((page, index) =>
                page === "ellipsis-start" || page === "ellipsis-end" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={index}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(page as number)
                      }}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <div className="text-sm text-center text-muted-foreground">
            Showing {indexOfFirstProduct + 1} to {Math.min(indexOfLastProduct, filteredProducts.length)} of{" "}
            {filteredProducts.length} products
          </div>
        </div>
      )}
    </div>
  )
}
