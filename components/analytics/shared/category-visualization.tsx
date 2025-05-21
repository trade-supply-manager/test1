"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { useMemo } from "react"

interface CategoryVisualizationProps {
  orderItemsData: any[]
  title?: string
  description?: string
}

export function CategoryVisualization({
  orderItemsData,
  title = "Revenue by Category",
  description = "Distribution of revenue across product categories",
}: CategoryVisualizationProps) {
  // Process category data
  const categoryData = useMemo(() => {
    const categoryMap = new Map()

    orderItemsData.forEach((item) => {
      const category = item.products?.product_category || "Uncategorized"
      const value = item.total_order_item_value || 0

      // Calculate profit using unit_margin from product_variants
      let profit = 0
      if (item.product_variants && item.product_variants.unit_margin !== null) {
        const unitMargin = item.product_variants.unit_margin || 0
        profit = unitMargin * value
      } else {
        // Fallback: estimate profit as 20% of revenue if no margin data
        profit = value * 0.2
      }

      const current = categoryMap.get(category) || {
        name: category,
        value: 0,
        profit: 0,
      }

      categoryMap.set(category, {
        ...current,
        value: current.value + value,
        profit: current.profit + profit,
      })
    })

    // Convert to array and sort by value
    return Array.from(categoryMap.values())
      .map((category) => ({
        ...category,
        profitMargin: category.value > 0 ? (category.profit / category.value) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [orderItemsData])

  // Calculate total value for percentage
  const totalValue = categoryData.reduce((sum, category) => sum + category.value, 0)

  // Chart colors
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658"]

  // Custom legend formatter to include value
  const renderLegend = (props: any) => {
    const { payload } = props

    return (
      <ul className="flex flex-col gap-2 text-sm">
        {payload.map((entry: any, index: number) => (
          <li key={`item-${index}`} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3" style={{ backgroundColor: entry.color }}></span>
            <span>
              {entry.payload.name}: $
              {Number(entry.payload.value).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              ({((entry.payload.value / totalValue) * 100).toFixed(1)}%)
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => [
                  `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                  "Revenue",
                ]}
              />
              <Legend content={renderLegend} layout="vertical" align="right" verticalAlign="middle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
