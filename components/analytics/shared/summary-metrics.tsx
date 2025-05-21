"use client"

import { DollarSign, Package, ShoppingCart, TrendingUp, Users } from "lucide-react"
import { MetricsCard } from "./metrics-card"

interface SummaryMetricsProps {
  orderData: any[]
  orderItemsData: any[]
  showProfit?: boolean
}

export function SummaryMetrics({ orderData, orderItemsData, showProfit = true }: SummaryMetricsProps) {
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
      <MetricsCard
        title="Total Sales"
        value={`$${Math.round(totalSales).toLocaleString("en-US")}`}
        description="For the selected period"
        icon={<DollarSign />}
      />

      {showProfit && (
        <MetricsCard
          title="Total Profit"
          value={`$${Math.round(totalProfit).toLocaleString("en-US")}`}
          description="For the selected period"
          icon={<TrendingUp />}
        />
      )}

      <MetricsCard
        title="Total Orders"
        value={totalOrders.toLocaleString("en-US")}
        description="Orders in selected period"
        icon={<ShoppingCart />}
      />

      <MetricsCard
        title="Unique Customers"
        value={uniqueCustomers.toLocaleString("en-US")}
        description="Customers who placed orders"
        icon={<Users />}
      />

      <MetricsCard
        title="Products Sold"
        value={totalProductsSold.toLocaleString("en-US")}
        description="Total quantity sold"
        icon={<Package />}
      />
    </div>
  )
}
