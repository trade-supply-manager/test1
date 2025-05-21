"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface CategoryPerformanceProps {
  orderItemsData: any[]
}

export function CategoryPerformance({ orderItemsData }: CategoryPerformanceProps) {
  // Process category data
  const categoryMap = new Map()

  orderItemsData.forEach((item) => {
    const category = item.products?.product_category || "Uncategorized"
    const value = item.total_order_item_value || 0

    const current = categoryMap.get(category) || {
      name: category,
      value: 0,
    }

    categoryMap.set(category, {
      ...current,
      value: current.value + value,
    })
  })

  // Convert to array and sort by value
  const categoryData = Array.from(categoryMap.values()).sort((a, b) => b.value - a.value)

  // Calculate total value for percentage
  const totalValue = categoryData.reduce((sum, category) => sum + category.value, 0)

  // Add percentage to data
  const chartData = categoryData.map((category) => ({
    ...category,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Category</CardTitle>
        <CardDescription>Distribution of revenue across product categories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 60,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(value) =>
                  `$${value.toLocaleString(undefined, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  })}`
                }
              />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip
                formatter={(value: any) => {
                  return [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "Revenue"]
                }}
              />
              <Legend />
              <Bar dataKey="value" name="Revenue" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
