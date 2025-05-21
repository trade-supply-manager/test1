"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts"
import { format, parseISO, startOfDay, startOfWeek, getMonth, getYear } from "date-fns"

interface SalesTrendsProps {
  orderData: any[]
}

export function SalesTrends({ orderData }: SalesTrendsProps) {
  const [dailyData, setDailyData] = useState<any[]>([])
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])

  useEffect(() => {
    // Process daily data
    const dailyMap = new Map()

    orderData.forEach((order) => {
      const date = startOfDay(new Date(order.date_created)).toISOString()
      const current = dailyMap.get(date) || { date, sales: 0, orders: 0 }

      dailyMap.set(date, {
        date,
        sales: current.sales + (order.total_order_value || 0),
        orders: current.orders + 1,
      })
    })

    setDailyData(Array.from(dailyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))

    // Process weekly data
    const weeklyMap = new Map()

    orderData.forEach((order) => {
      const date = startOfWeek(new Date(order.date_created)).toISOString()
      const current = weeklyMap.get(date) || { date, sales: 0, orders: 0 }

      weeklyMap.set(date, {
        date,
        sales: current.sales + (order.total_order_value || 0),
        orders: current.orders + 1,
      })
    })

    setWeeklyData(
      Array.from(weeklyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    )

    // Process monthly data
    const monthlyMap = new Map()

    orderData.forEach((order) => {
      const orderDate = new Date(order.date_created)
      const monthYear = `${getYear(orderDate)}-${getMonth(orderDate) + 1}`
      const current = monthlyMap.get(monthYear) || {
        monthYear,
        month: format(orderDate, "MMM yyyy"),
        sales: 0,
        orders: 0,
      }

      monthlyMap.set(monthYear, {
        ...current,
        sales: current.sales + (order.total_order_value || 0),
        orders: current.orders + 1,
      })
    })

    setMonthlyData(
      Array.from(monthlyMap.values()).sort((a, b) => {
        const [yearA, monthA] = a.monthYear.split("-").map(Number)
        const [yearB, monthB] = b.monthYear.split("-").map(Number)
        return yearA !== yearB ? yearA - yearB : monthA - monthB
      }),
    )

    // Process status data
    const statusMap = new Map()

    orderData.forEach((order) => {
      const status = order.status || "Unknown"
      const current = statusMap.get(status) || { status, count: 0, value: 0 }

      statusMap.set(status, {
        status,
        count: current.count + 1,
        value: current.value + (order.total_order_value || 0),
      })
    })

    setStatusData(Array.from(statusMap.values()))
  }, [orderData])

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM dd")
    } catch (e) {
      return dateStr
    }
  }

  const formatWeek = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "'Week of' MMM dd")
    } catch (e) {
      return dateStr
    }
  }

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="status">By Status</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales</CardTitle>
              <CardDescription>Sales trend over the selected period by day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dailyData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Sales"]}
                      labelFormatter={formatDate}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="sales" name="Sales" stroke="#8884d8" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Sales</CardTitle>
              <CardDescription>Sales aggregated by week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatWeek} tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Sales"]}
                      labelFormatter={formatWeek}
                    />
                    <Legend />
                    <Bar dataKey="sales" name="Sales" fill="#8884d8" />
                    <Bar dataKey="orders" name="Orders" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Sales</CardTitle>
              <CardDescription>Sales aggregated by month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Sales"]} />
                    <Legend />
                    <Bar dataKey="sales" name="Sales" fill="#8884d8" />
                    <Bar dataKey="orders" name="Orders" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Order Status</CardTitle>
              <CardDescription>Distribution of sales by order status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="status" type="category" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Value"]} />
                    <Legend />
                    <Bar dataKey="value" name="Order Value" fill="#8884d8" />
                    <Bar dataKey="count" name="Order Count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
