"use client"

import { useMemo } from "react"
import type { DateRange } from "react-day-picker"
import { format, parseISO, startOfWeek, startOfMonth, getWeek, getYear, isWithinInterval, addDays } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

interface SalesTrendsProps {
  orderData: any[]
  groupBy: "daily" | "weekly" | "monthly" | "status"
  dateRange: DateRange | undefined
}

export function SalesTrends({ orderData, groupBy, dateRange }: SalesTrendsProps) {
  const chartData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || orderData.length === 0) {
      return []
    }

    if (groupBy === "status") {
      // Group by status
      const statusMap = new Map()

      orderData.forEach((order) => {
        const status = order.status || "Unknown"
        const currentTotal = statusMap.get(status) || 0
        statusMap.set(status, currentTotal + (order.total_order_value || 0))
      })

      return Array.from(statusMap.entries()).map(([status, value]) => ({
        name: status,
        value,
      }))
    }

    // For time-based grouping
    const salesByPeriod = new Map()

    orderData.forEach((order) => {
      if (!order.delivery_date) return

      const orderDate = parseISO(order.delivery_date)

      // Skip if outside date range
      if (
        !isWithinInterval(orderDate, {
          start: dateRange.from,
          end: addDays(dateRange.to, 1), // Include end date
        })
      ) {
        return
      }

      let periodKey
      let periodLabel

      if (groupBy === "daily") {
        periodKey = format(orderDate, "yyyy-MM-dd")
        periodLabel = format(orderDate, "MMM dd")
      } else if (groupBy === "weekly") {
        const weekStart = startOfWeek(orderDate)
        periodKey = `${getYear(weekStart)}-W${getWeek(weekStart)}`
        periodLabel = `Week ${getWeek(weekStart)}`
      } else if (groupBy === "monthly") {
        const monthStart = startOfMonth(orderDate)
        periodKey = format(monthStart, "yyyy-MM")
        periodLabel = format(monthStart, "MMM yyyy")
      }

      if (!periodKey) return

      const currentPeriod = salesByPeriod.get(periodKey) || {
        name: periodLabel,
        value: 0,
        count: 0,
      }

      salesByPeriod.set(periodKey, {
        ...currentPeriod,
        value: currentPeriod.value + (order.total_order_value || 0),
        count: currentPeriod.count + 1,
      })
    })

    // Convert to array and sort by period
    return Array.from(salesByPeriod.values())
  }, [orderData, groupBy, dateRange])

  // No data state
  if (chartData.length === 0) {
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

  // Determine chart title and description based on groupBy
  let title = "Sales Trend"
  let description = ""

  switch (groupBy) {
    case "daily":
      title = "Daily Sales"
      description = "Sales trend over the selected period by day"
      break
    case "weekly":
      title = "Weekly Sales"
      description = "Sales aggregated by week"
      break
    case "monthly":
      title = "Monthly Sales"
      description = "Sales aggregated by month"
      break
    case "status":
      title = "Sales by Order Status"
      description = "Total sales broken down by order status"
      break
  }

  // Use bar chart for status, line chart for time series
  const isBarChart = groupBy === "status"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {isBarChart ? (
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Sales"]} />
                <Legend />
                <Bar dataKey="value" name="Sales" fill="#8884d8" />
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Sales"]} />
                <Legend />
                <Line type="monotone" dataKey="value" name="Sales" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
