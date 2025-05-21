"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from "recharts"

interface ProductPerformanceProps {
  orderItemsData: any[]
  displayType?: "bar" | "pie"
  title?: string
  description?: string
}

export function ProductPerformance({
  orderItemsData,
  displayType = "bar",
  title = "Top Products by Revenue",
  description = "Top 10 products by sales value",
}: ProductPerformanceProps) {
  const [searchTerm, setSearchTerm] = useState("")

  // Process product data
  const productMap = new Map()

  orderItemsData.forEach((item) => {
    const productName = item.products?.product_name || "Unknown Product"
    const variantName = item.product_variants?.product_variant_name
    const fullName = variantName ? `${productName} - ${variantName}` : productName
    const category = item.products?.product_category || "Uncategorized"
    const quantity = item.quantity || 0
    const value = item.total_order_item_value || 0

    // Calculate profit using unit_margin from product_variants
    let profit = 0
    if (item.product_variants && item.product_variants.unit_margin !== null) {
      const unitMargin = item.product_variants.unit_margin || 0
      // unit_margin is a percentage (0-1), so multiply by the total value
      profit = unitMargin * value
    } else {
      // Fallback: estimate profit as 20% of revenue if no margin data
      profit = value * 0.2
    }

    const current = productMap.get(fullName) || {
      name: fullName,
      category,
      quantity: 0,
      value: 0,
      profit: 0,
      averagePrice: 0,
    }

    productMap.set(fullName, {
      ...current,
      quantity: current.quantity + quantity,
      value: current.value + value,
      profit: current.profit + profit,
      averagePrice: (current.value + value) / (current.quantity + quantity),
    })
  })

  // Convert to array and sort by value
  let productData = Array.from(productMap.values()).sort((a, b) => b.value - a.value)

  // Filter by search term
  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    productData = productData.filter(
      (product) => product.name.toLowerCase().includes(term) || product.category.toLowerCase().includes(term),
    )
  }

  // Get top 10 for chart
  const topProducts = productData.slice(0, 10)

  // Calculate total value for percentage
  const totalValue = productData.reduce((sum, product) => sum + product.value, 0)

  // Prepare chart data
  const chartData = topProducts.map((product) => ({
    name: product.name.length > 20 ? product.name.substring(0, 20) + "..." : product.name,
    value: product.value,
    percentage: (product.value / totalValue) * 100,
  }))

  // Chart colors
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
    "#FFC658",
    "#8DD1E1",
    "#A4DE6C",
    "#D0ED57",
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {displayType === "bar" ? (
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tickFormatter={(value) => (value.length > 15 ? `${value.substring(0, 15)}...` : value)}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      "Revenue",
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="value" name="Revenue">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [
                      `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      "Revenue",
                    ]}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product Sales Details</CardTitle>
          <CardDescription>Detailed breakdown of product sales</CardDescription>
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Avg. Price</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productData.map((product, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell className="text-right">{product.quantity}</TableCell>
                  <TableCell className="text-right">${product.averagePrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${product.value.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${product.profit.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {product.value > 0 ? ((product.profit / product.value) * 100).toFixed(1) : "0.0"}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
