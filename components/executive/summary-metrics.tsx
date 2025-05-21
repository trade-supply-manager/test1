"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Package, ShoppingCart, TrendingUp, Users } from "lucide-react"

interface SummaryMetricsProps {
  orderData: any[]
  orderItemsData: any[]
}

export function SummaryMetrics({ orderData, orderItemsData }: SummaryMetricsProps) {
  // Calculate total sales
  const totalSales = orderData.reduce((sum, order) => sum + (order.total_order_value || 0), 0)

  // Calculate total profit using unit_margin
  const totalProfit = orderItemsData.reduce((sum, item) => {
    let profit = 0
    if (item.product_variants && item.product_variants.unit_margin !== null) {
      const unitMargin = item.product_variants.unit_margin || 0
      const revenue = item.total_order_item_value || 0
      // unit_margin is a percentage (0-1), so multiply by the total value
      profit = unitMargin * revenue
    } else {
      // Fallback: estimate profit as 20% of revenue if no margin data
      profit = (item.total_order_item_value || 0) * 0.2
    }
    return sum + profit
  }, 0)

  // Calculate average order value
  const averageOrderValue = orderData.length > 0 ? totalSales / orderData.length : 0

  // Count total orders
  const totalOrders = orderData.length

  // Count unique customers
  const uniqueCustomers = new Set(orderData.map((order) => order.customer_id)).size

  // Count total products sold
  const totalProductsSold = orderItemsData.reduce((sum, item) => sum + (item.quantity || 0), 0)

  // Calculate overall profit margin
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">For the selected period</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalProfit.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">{profitMargin.toFixed(1)}% margin</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalOrders}</div>
          <p className="text-xs text-muted-foreground">Orders in selected period</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unique Customers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueCustomers}</div>
          <p className="text-xs text-muted-foreground">Customers who placed orders</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Products Sold</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProductsSold}</div>
          <p className="text-xs text-muted-foreground">Total quantity sold</p>
        </CardContent>
      </Card>
    </div>
  )
}
