"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface PerformanceChartsProps {
  orderItemsData: any[]
}

export function PerformanceCharts({ orderItemsData }: PerformanceChartsProps) {
  // Process data for charts
  const topProducts = useMemo(() => {
    // Group by product (combining variants)
    const productMap = new Map()

    orderItemsData.forEach((item) => {
      const productName = item.products?.product_name || "Unknown Product"
      const variantName = item.product_variants?.product_variant_name
      const fullName = variantName ? `${productName} - ${variantName}` : productName
      const value = item.total_order_item_value || 0

      // Update product map
      const currentProduct = productMap.get(fullName) || {
        name: fullName,
        value: 0,
      }
      productMap.set(fullName, {
        ...currentProduct,
        value: currentProduct.value + value,
      })
    })

    // Convert to array, sort by value, and take top 10
    return Array.from(productMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((product) => ({
        name: product.name.length > 20 ? product.name.substring(0, 20) + "..." : product.name,
        value: product.value,
      }))
  }, [orderItemsData])

  // No data state
  if (orderItemsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Data Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No data is available for the selected filters. Try adjusting your date range or other filters.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Products by Revenue</CardTitle>
        <CardDescription>Highest revenue generating products</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [
                  `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                  "Revenue",
                ]}
              />
              <Bar dataKey="value" name="Revenue" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
