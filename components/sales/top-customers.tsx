"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface TopCustomersProps {
  orderData: any[]
}

export function TopCustomers({ orderData }: TopCustomersProps) {
  const [searchTerm, setSearchTerm] = useState("")

  // Process customer data
  const customerMap = new Map()

  orderData.forEach((order) => {
    const customerId = order.customer_id
    const customerName = order.customers?.customer_name || "Unknown Customer"
    const orderValue = order.total_order_value || 0

    const current = customerMap.get(customerId) || {
      id: customerId,
      name: customerName,
      orderCount: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    }

    customerMap.set(customerId, {
      ...current,
      orderCount: current.orderCount + 1,
      totalSpent: current.totalSpent + orderValue,
      averageOrderValue: (current.totalSpent + orderValue) / (current.orderCount + 1),
    })
  })

  // Convert to array and sort by total spent
  let customerData = Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent)

  // Filter by search term
  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    customerData = customerData.filter((customer) => customer.name.toLowerCase().includes(term))
  }

  // Get top 10 for chart
  const topCustomers = customerData.slice(0, 10)

  // Calculate total value for percentage
  const totalValue = customerData.reduce((sum, customer) => sum + customer.totalSpent, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Top Customers by Revenue</CardTitle>
          <CardDescription>Top 10 customers by total spending</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCustomers.map((customer) => ({
                  name: customer.name.length > 20 ? customer.name.substring(0, 20) + "..." : customer.name,
                  totalSpent: customer.totalSpent,
                  orderCount: customer.orderCount,
                }))}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 100,
                }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={150} />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    return name === "totalSpent"
                      ? [`$${Number(value).toFixed(2)}`, "Total Spent"]
                      : [value, "Order Count"]
                  }}
                />
                <Legend />
                <Bar dataKey="totalSpent" name="Total Spent" fill="#8884d8" />
                <Bar dataKey="orderCount" name="Order Count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Sales Details</CardTitle>
          <CardDescription>Detailed breakdown of customer sales</CardDescription>
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Avg. Order Value</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">% of Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerData.map((customer, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-right">{customer.orderCount}</TableCell>
                  <TableCell className="text-right">${customer.averageOrderValue.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${customer.totalSpent.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{((customer.totalSpent / totalValue) * 100).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
