"use client"

import { useState, useEffect } from "react"
import type { DateRange } from "react-day-picker"
import { addDays, isAfter, isBefore, parseISO, startOfDay, subDays } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { SummaryMetrics } from "@/components/analytics/shared/summary-metrics"
import { SalesTrends } from "@/components/analytics/shared/sales-trends"
import { PerformanceCharts } from "@/components/executive/performance-charts"
import { CategoryPerformance } from "@/components/executive/category-performance"
import { ProductPerformanceTable } from "@/components/executive/product-performance-table"
import { BarChart3, LineChart } from "lucide-react"

interface ExecutiveDashboardProps {
  orderData: any[]
  orderItemsData: any[]
  categories: string[]
  manufacturers: { id: string; manufacturer_name: string }[]
}

export function ExecutiveDashboard({ orderData, orderItemsData, categories, manufacturers }: ExecutiveDashboardProps) {
  // Date range state
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  // Filter states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([])

  // Filtered data based on date range and other filters
  const [filteredOrderData, setFilteredOrderData] = useState(orderData)
  const [filteredOrderItemsData, setFilteredOrderItemsData] = useState(orderItemsData)

  // Apply filters when date range or other filters change
  useEffect(() => {
    if (!date?.from || !date?.to) return

    const fromDate = startOfDay(date.from)
    const toDate = startOfDay(addDays(date.to, 1)) // Include the end date

    // Filter orders by date range
    const dateFilteredOrders = orderData.filter((order) => {
      const orderDate = parseISO(order.delivery_date)
      return !isBefore(orderDate, fromDate) && !isAfter(orderDate, toDate)
    })

    // Apply category and manufacturer filters if selected
    const filteredOrders = dateFilteredOrders

    // Filter order items by date, category, and manufacturer
    const filteredItems = orderItemsData.filter((item) => {
      // Find the corresponding order to check date
      const order = orderData.find((o) => o.id === item.customer_order_id)
      if (!order) return false

      const orderDate = parseISO(order.delivery_date)
      const dateInRange = !isBefore(orderDate, fromDate) && !isAfter(orderDate, toDate)

      // Check category filter if applied
      const categoryMatch =
        selectedCategories.length === 0 ||
        selectedCategories.includes(item.products?.product_category || "Uncategorized")

      // Check manufacturer filter if applied
      const manufacturerMatch =
        selectedManufacturers.length === 0 || selectedManufacturers.includes(item.products?.manufacturer_id)

      return dateInRange && categoryMatch && manufacturerMatch
    })

    // Update filtered data
    setFilteredOrderData(filteredOrders)
    setFilteredOrderItemsData(filteredItems)
  }, [date, selectedCategories, selectedManufacturers, orderData, orderItemsData])

  // Handle category filter change
  const handleCategoryChange = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    )
  }

  // Handle manufacturer filter change
  const handleManufacturerChange = (manufacturerId: string) => {
    setSelectedManufacturers((prev) =>
      prev.includes(manufacturerId) ? prev.filter((m) => m !== manufacturerId) : [...prev, manufacturerId],
    )
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">Sales Analytics Dashboard</h1>
        <DateRangePicker date={date} onDateChange={setDate} className="w-full md:w-auto" />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Filter by Category:</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`px-3 py-1 text-xs rounded-full ${
                  selectedCategories.includes(category)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Filter by Manufacturer:</h3>
          <div className="flex flex-wrap gap-2">
            {manufacturers.map((manufacturer) => (
              <button
                key={manufacturer.id}
                onClick={() => handleManufacturerChange(manufacturer.id)}
                className={`px-3 py-1 text-xs rounded-full ${
                  selectedManufacturers.includes(manufacturer.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {manufacturer.manufacturer_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <SummaryMetrics orderData={filteredOrderData} orderItemsData={filteredOrderItemsData} />

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="performance">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-muted rounded-md">
          <TabsTrigger
            value="performance"
            className="flex items-center justify-center gap-2 rounded-sm data-[state=active]:bg-black data-[state=active]:text-white"
          >
            <LineChart className="h-4 w-4" />
            <span>Performance Charts</span>
          </TabsTrigger>
          <TabsTrigger
            value="products"
            className="flex items-center justify-center gap-2 rounded-sm data-[state=active]:bg-black data-[state=active]:text-white"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Product Performance</span>
          </TabsTrigger>
        </TabsList>

        {/* Performance Charts Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Tabs defaultValue="daily" className="w-full">
            <TabsList className="bg-muted rounded-md">
              <TabsTrigger
                value="daily"
                className="flex items-center gap-1 rounded-sm data-[state=active]:bg-black data-[state=active]:text-white"
              >
                Daily
              </TabsTrigger>
              <TabsTrigger
                value="weekly"
                className="flex items-center gap-1 rounded-sm data-[state=active]:bg-black data-[state=active]:text-white"
              >
                Weekly
              </TabsTrigger>
              <TabsTrigger
                value="monthly"
                className="flex items-center gap-1 rounded-sm data-[state=active]:bg-black data-[state=active]:text-white"
              >
                Monthly
              </TabsTrigger>
            </TabsList>
            <TabsContent value="daily">
              <SalesTrends orderData={filteredOrderData} groupBy="daily" dateRange={date} />
            </TabsContent>
            <TabsContent value="weekly">
              <SalesTrends orderData={filteredOrderData} groupBy="weekly" dateRange={date} />
            </TabsContent>
            <TabsContent value="monthly">
              <SalesTrends orderData={filteredOrderData} groupBy="monthly" dateRange={date} />
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <PerformanceCharts orderItemsData={filteredOrderItemsData} />
            </div>
            <div className="md:col-span-1">
              <CategoryPerformance orderItemsData={filteredOrderItemsData} />
            </div>
          </div>
        </TabsContent>

        {/* Product Performance Tab */}
        <TabsContent value="products">
          <ProductPerformanceTable orderItemsData={filteredOrderItemsData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
