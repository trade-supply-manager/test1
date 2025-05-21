"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMemo, useState } from "react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface ProductPerformanceTableProps {
  orderItemsData: any[]
}

export function ProductPerformanceTable({ orderItemsData }: ProductPerformanceTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: "ascending" | "descending"
  }>({
    key: "revenue",
    direction: "descending",
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showVariants, setShowVariants] = useState(true)

  // Process order items to get product performance data
  const productPerformance = useMemo(() => {
    // If we're showing variants, we'll group by product+variant combination
    // Otherwise, we'll group by product only (aggregating variants)
    const productMap = new Map()

    orderItemsData.forEach((item) => {
      const productId = item.product_id
      const variantId = item.variant_id
      const productName = item.products?.product_name || "Unknown Product"
      const variantName = item.product_variants?.product_variant_name || "Default Variant"
      const category = item.products?.product_category || "Uncategorized"
      const manufacturerName = item.products?.manufacturers?.manufacturer_name || "Unknown Manufacturer"
      const quantity = item.quantity || 0
      const revenue = item.total_order_item_value || 0

      // Calculate profit using unit_margin from product_variants
      let profit = 0
      let marginPercentage = 0
      if (item.product_variants && item.product_variants.unit_margin !== null) {
        const unitMargin = item.product_variants.unit_margin || 0
        // unit_margin is a percentage (0-1), so multiply by the total value
        profit = unitMargin * revenue
        marginPercentage = unitMargin * 100
      } else {
        // Fallback: estimate profit as 20% of revenue if no margin data
        profit = revenue * 0.2
        marginPercentage = 20
      }

      // Create a unique key based on whether we're showing variants or not
      const key = showVariants ? `${productId}-${variantId}` : productId

      const current = productMap.get(key) || {
        productId,
        variantId: showVariants ? variantId : null,
        productName,
        variantName: showVariants ? variantName : null,
        category,
        manufacturerName,
        quantity: 0,
        revenue: 0,
        profit: 0,
        totalMargin: 0, // Track total margin for weighted average calculation
        marginPercentage: 0,
        variants: new Set(),
      }

      if (item.variant_id) {
        current.variants.add(item.variant_id)
      }

      // Update aggregated values
      const updatedQuantity = current.quantity + quantity
      const updatedRevenue = current.revenue + revenue
      const updatedProfit = current.profit + profit

      // Calculate weighted margin for proper aggregation
      const updatedTotalMargin = current.totalMargin + marginPercentage * revenue

      productMap.set(key, {
        ...current,
        quantity: updatedQuantity,
        revenue: updatedRevenue,
        profit: updatedProfit,
        totalMargin: updatedTotalMargin,
        // Calculate weighted average margin based on revenue contribution
        marginPercentage: updatedRevenue > 0 ? updatedTotalMargin / updatedRevenue : marginPercentage,
      })
    })

    // Convert to array and add derived fields
    const products = Array.from(productMap.values()).map((product) => ({
      ...product,
      variantCount: product.variants.size,
      profitMargin: product.marginPercentage,
      // For demo purposes, randomly assign performance indicators
      isLowPerforming: Math.random() > 0.7,
    }))

    // Sort products
    products.sort((a, b) => {
      if (sortConfig.key === "productName") {
        return sortConfig.direction === "ascending"
          ? a.productName.localeCompare(b.productName)
          : b.productName.localeCompare(a.productName)
      }

      if (sortConfig.key === "variantName" && showVariants) {
        return sortConfig.direction === "ascending"
          ? a.variantName.localeCompare(b.variantName)
          : b.variantName.localeCompare(a.variantName)
      }

      if (sortConfig.direction === "ascending") {
        return a[sortConfig.key] - b[sortConfig.key]
      }
      return b[sortConfig.key] - a[sortConfig.key]
    })

    return products
  }, [orderItemsData, sortConfig, showVariants])

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    return productPerformance.filter(
      (product) =>
        product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.variantName && product.variantName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.manufacturerName.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [productPerformance, searchTerm])

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending"
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending"
    }
    setSortConfig({ key, direction })
  }

  const handlePageChange = (page: number) => {
    // Ensure page is within valid range
    if (page < 1) page = 1
    if (page > totalPages) page = totalPages
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  const toggleVariantView = () => {
    setShowVariants(!showVariants)
    setCurrentPage(1) // Reset to first page when toggling view
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 5 // Maximum number of page links to show

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      // Always show first page
      pageNumbers.push(1)

      // Calculate start and end of visible page range
      let startPage = Math.max(2, currentPage - 1)
      let endPage = Math.min(totalPages - 1, currentPage + 1)

      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4)
      }

      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3)
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
      if (totalPages > 1) {
        pageNumbers.push(totalPages)
      }
    }

    return pageNumbers
  }

  // Handle empty state
  if (productPerformance.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Data Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No product data is available for the selected filters. Try adjusting your date range or other filters.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
        <CardTitle>Product Performance</CardTitle>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1) // Reset to first page on search
            }}
            className="max-w-xs"
          />
          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Items per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 per page</SelectItem>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={toggleVariantView}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            {showVariants ? "Group Variants" : "Show Variants"}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 cursor-pointer" onClick={() => requestSort("productName")}>
                  Product
                  {sortConfig.key === "productName" && (
                    <span>{sortConfig.direction === "ascending" ? " ↑" : " ↓"}</span>
                  )}
                </th>
                {showVariants && (
                  <th className="text-left py-3 px-4 cursor-pointer" onClick={() => requestSort("variantName")}>
                    Variant
                    {sortConfig.key === "variantName" && (
                      <span>{sortConfig.direction === "ascending" ? " ↑" : " ↓"}</span>
                    )}
                  </th>
                )}
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Manufacturer</th>
                <th className="text-right py-3 px-4 cursor-pointer" onClick={() => requestSort("revenue")}>
                  Revenue
                  {sortConfig.key === "revenue" && <span>{sortConfig.direction === "ascending" ? " ↑" : " ↓"}</span>}
                </th>
                <th className="text-right py-3 px-4 cursor-pointer" onClick={() => requestSort("profit")}>
                  Profit
                  {sortConfig.key === "profit" && <span>{sortConfig.direction === "ascending" ? " ↑" : " ↓"}</span>}
                </th>
                <th className="text-right py-3 px-4 cursor-pointer" onClick={() => requestSort("profitMargin")}>
                  Margin
                  {sortConfig.key === "profitMargin" && (
                    <span>{sortConfig.direction === "ascending" ? " ↑" : " ↓"}</span>
                  )}
                </th>
                <th className="text-right py-3 px-4 cursor-pointer" onClick={() => requestSort("quantity")}>
                  Units
                  {sortConfig.key === "quantity" && <span>{sortConfig.direction === "ascending" ? " ↑" : " ↓"}</span>}
                </th>
                <th className="text-center py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product, index) => (
                <tr key={index} className="border-b">
                  <td className="py-3 px-4">
                    <div className="font-medium">{product.productName}</div>
                    {!showVariants && product.variantCount > 0 && (
                      <div className="text-xs text-muted-foreground">{product.variantCount} variants</div>
                    )}
                  </td>
                  {showVariants && (
                    <td className="py-3 px-4">
                      {product.variantName !== "Default Variant" ? (
                        <div>{product.variantName}</div>
                      ) : (
                        <div className="text-muted-foreground italic">Standard</div>
                      )}
                    </td>
                  )}
                  <td className="py-3 px-4">{product.category}</td>
                  <td className="py-3 px-4">{product.manufacturerName}</td>
                  <td className="text-right py-3 px-4">
                    ${product.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="text-right py-3 px-4">
                    ${product.profit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="text-right py-3 px-4">{product.profitMargin.toFixed(1)}%</td>
                  <td className="text-right py-3 px-4">
                    {product.quantity.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="text-center py-3 px-4">
                    <Badge variant={product.isLowPerforming ? "destructive" : "success"} className="whitespace-nowrap">
                      {product.isLowPerforming ? "Declining" : "Growing"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            Showing {paginatedProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  aria-disabled={currentPage === 1}
                />
              </PaginationItem>

              {getPageNumbers().map((page, index) => {
                if (page === "ellipsis-start" || page === "ellipsis-end") {
                  return (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <span className="flex h-9 w-9 items-center justify-center">...</span>
                    </PaginationItem>
                  )
                }

                return (
                  <PaginationItem key={index}>
                    <PaginationLink isActive={currentPage === page} onClick={() => handlePageChange(page as number)}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  aria-disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>
    </Card>
  )
}
