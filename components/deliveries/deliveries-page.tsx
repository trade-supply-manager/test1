"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { format, parseISO, isValid, startOfDay, endOfDay, isAfter, isBefore } from "date-fns"
import { CalendarIcon, AlertTriangle, Clock, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { DeliveriesTable } from "./deliveries-table"
import { ConflictGroup } from "./conflict-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface DeliveryOrder {
  id: string
  order_name: string
  delivery_date: string | null
  status: string
  delivery_time: string | null
  total_order_value?: number | null
  delivery_address?: string | null
  delivery_method?: string | null
  delivery_instructions?: string | null
  customers: {
    id: string
    customer_name: string
  }
}

interface DeliveriesPageProps {
  orders: DeliveryOrder[]
}

export function DeliveriesPage({ orders }: DeliveriesPageProps) {
  const [maxDeliveriesPerDay, setMaxDeliveriesPerDay] = useState(5)
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined,
  })
  const [activeTab, setActiveTab] = useState("conflicts")

  // Find conflicts and filter orders
  const { filteredOrders, totalConflicts, daysOverThreshold, timeConflicts, conflictGroups, nonConflictOrders } =
    useMemo(() => {
      // First, filter by date range if set
      let dateFilteredOrders = [...orders]

      if (dateRange.from || dateRange.to) {
        dateFilteredOrders = orders.filter((order) => {
          if (!order.delivery_date) return false

          try {
            const orderDate = parseISO(order.delivery_date)
            if (!isValid(orderDate)) return false

            if (dateRange.from && dateRange.to) {
              return isAfter(orderDate, startOfDay(dateRange.from)) && isBefore(orderDate, endOfDay(dateRange.to))
            } else if (dateRange.from) {
              return isAfter(orderDate, startOfDay(dateRange.from))
            } else if (dateRange.to) {
              return isBefore(orderDate, endOfDay(dateRange.to))
            }
          } catch (error) {
            console.error("Error filtering by date range:", error)
          }

          return false
        })
      }

      // Group orders by date
      const ordersByDate: Record<string, DeliveryOrder[]> = {}
      const daysOverThresholdMap: Record<string, DeliveryOrder[]> = {}
      const timeConflictsByDay: Record<string, Record<string, DeliveryOrder[]>> = {}
      const timeConflictOrders: DeliveryOrder[] = []
      const allConflictOrders: Set<string> = new Set()

      dateFilteredOrders.forEach((order) => {
        if (!order.delivery_date) return

        try {
          const date = parseISO(order.delivery_date)
          if (!isValid(date)) return

          const dateKey = format(date, "yyyy-MM-dd")
          if (!ordersByDate[dateKey]) {
            ordersByDate[dateKey] = []
          }
          ordersByDate[dateKey].push(order)
        } catch (error) {
          console.error("Error grouping by date:", error)
        }
      })

      // Find days over threshold and time conflicts
      Object.entries(ordersByDate).forEach(([dateKey, dateOrders]) => {
        // Check if day is over threshold
        if (dateOrders.length > maxDeliveriesPerDay) {
          daysOverThresholdMap[dateKey] = dateOrders
          dateOrders.forEach((order) => {
            allConflictOrders.add(order.id)
          })
        }

        // Check for time conflicts
        const ordersByTime: Record<string, DeliveryOrder[]> = {}

        dateOrders.forEach((order) => {
          if (!order.delivery_time) return

          const timeKey = order.delivery_time
          if (!ordersByTime[timeKey]) {
            ordersByTime[timeKey] = []
          }
          ordersByTime[timeKey].push(order)
        })

        // Store time conflicts by day
        const dayTimeConflicts: Record<string, DeliveryOrder[]> = {}

        Object.entries(ordersByTime).forEach(([timeKey, timeOrders]) => {
          if (timeOrders.length > 1) {
            dayTimeConflicts[timeKey] = timeOrders
            timeOrders.forEach((order) => {
              timeConflictOrders.push(order)
              allConflictOrders.add(order.id)
            })
          }
        })

        if (Object.keys(dayTimeConflicts).length > 0) {
          timeConflictsByDay[dateKey] = dayTimeConflicts
        }
      })

      // Create conflict groups
      const conflictGroups = []

      // 1. Days over threshold
      Object.entries(daysOverThresholdMap).forEach(([dateKey, dateOrders]) => {
        try {
          const date = parseISO(dateKey)
          if (!isValid(date)) return

          conflictGroups.push({
            type: "threshold",
            title: `Too Many Deliveries on ${format(date, "MMMM d, yyyy")}`,
            description: `This day has ${dateOrders.length} deliveries, exceeding the maximum of ${maxDeliveriesPerDay}`,
            orders: dateOrders,
            date: date,
            icon: <Calendar className="h-4 w-4 text-red-600" />,
          })
        } catch (error) {
          console.error("Error creating threshold conflict group:", error)
        }
      })

      // 2. Time conflicts
      Object.entries(timeConflictsByDay).forEach(([dateKey, timeConflicts]) => {
        try {
          const date = parseISO(dateKey)
          if (!isValid(date)) return

          Object.entries(timeConflicts).forEach(([timeKey, timeOrders]) => {
            conflictGroups.push({
              type: "time",
              title: `Time Conflict on ${format(date, "MMMM d, yyyy")} at ${timeKey}`,
              description: `${timeOrders.length} deliveries scheduled at the same time`,
              orders: timeOrders,
              date: date,
              time: timeKey,
              icon: <Clock className="h-4 w-4 text-red-600" />,
            })
          })
        } catch (error) {
          console.error("Error creating time conflict group:", error)
        }
      })

      // Sort conflict groups by date
      conflictGroups.sort((a, b) => a.date.getTime() - b.date.getTime())

      // Get non-conflict orders
      const nonConflictOrders = dateFilteredOrders.filter((order) => !allConflictOrders.has(order.id))

      return {
        filteredOrders: dateFilteredOrders,
        totalConflicts: allConflictOrders.size,
        daysOverThreshold: Object.keys(daysOverThresholdMap).length,
        timeConflicts: timeConflictOrders.length,
        conflictGroups,
        nonConflictOrders,
      }
    }, [orders, maxDeliveriesPerDay, dateRange])

  // Handle max deliveries change
  const handleMaxDeliveriesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(e.target.value)
    if (!isNaN(value) && value > 0) {
      setMaxDeliveriesPerDay(value)
    }
  }

  return (
    <div className="space-y-6">
      {/* Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Conflicts</p>
                <h3 className="text-2xl font-bold">{totalConflicts}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Days Over Threshold</p>
                <h3 className="text-2xl font-bold">{daysOverThreshold}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time Conflicts</p>
                <h3 className="text-2xl font-bold">{timeConflicts}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="maxDeliveries" className="mb-2 block">
              Maximum Deliveries Per Day
            </Label>
            <Input
              id="maxDeliveries"
              type="number"
              min="1"
              value={maxDeliveriesPerDay}
              onChange={handleMaxDeliveriesChange}
              className="max-w-[200px]"
            />
          </div>

          <div>
            <Label className="mb-2 block">Date Range</Label>
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                </PopoverContent>
              </Popover>

              {(dateRange.from || dateRange.to) && (
                <Button variant="ghost" size="sm" onClick={() => setDateRange({ from: undefined, to: undefined })}>
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="conflicts">Conflicts ({totalConflicts})</TabsTrigger>
          <TabsTrigger value="all">All Deliveries ({filteredOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts" className="space-y-4 mt-4">
          {conflictGroups.length === 0 ? (
            <div className="bg-white rounded-md border p-8 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Delivery Conflicts</h3>
                <p className="text-muted-foreground">
                  All deliveries are properly scheduled with no conflicts detected
                </p>
              </div>
            </div>
          ) : (
            <>
              {conflictGroups.map((group, index) => (
                <ConflictGroup
                  key={`${group.type}-${index}`}
                  title={group.title}
                  description={group.description}
                  orders={group.orders}
                  icon={group.icon}
                  defaultOpen={false}
                />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <DeliveriesTable orders={filteredOrders} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
