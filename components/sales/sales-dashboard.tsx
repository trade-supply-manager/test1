"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "../ui/date-range-picker"
import { addDays, subDays } from "date-fns"
import { SummaryMetrics } from "../analytics/shared/summary-metrics"
import { SalesTrends } from "../analytics/shared/sales-trends"
import { ProductPerformance } from "../analytics/shared/product-performance"
import { TopCustomers } from "./top-customers"

interface SalesDashboardProps {
  orderData: any[]
  orderItemsData: any[]
}

export function SalesDashboard({ orderData, orderItemsData }: SalesDashboardProps) {
  const [dateRange, setDateRange] = useState<{
    from: Date
    to: Date
  }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  // Filter data based on date range
  const filteredOrders = orderData.filter((order) => {
    const orderDate = new Date(order.date_created)
    return orderDate >= dateRange.from && orderDate <= addDays(dateRange.to, 1)
  })

  // Get order IDs from filtered orders
  const filteredOrderIds = filteredOrders.map((order) => order.id)

  // Filter order items based on filtered order IDs
  const filteredOrderItems = orderItemsData.filter((item) => filteredOrderIds.includes(item.customer_order_id))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Sales Dashboard</h1>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <SummaryMetrics orderData={filteredOrders} orderItemsData={filteredOrderItems} showProfit={false} />

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Sales Trends</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="customers">Top Customers</TabsTrigger>
        </TabsList>
        <TabsContent value="trends" className="space-y-4">
          <SalesTrends orderData={filteredOrders} />
        </TabsContent>
        <TabsContent value="products" className="space-y-4">
          <ProductPerformance orderItemsData={filteredOrderItems} />
        </TabsContent>
        <TabsContent value="customers" className="space-y-4">
          <TopCustomers orderData={filteredOrders} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
