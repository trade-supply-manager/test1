"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase-client"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Mail } from "lucide-react"
import { log, LogLevel } from "@/lib/debug-utils"

interface ManufacturerEmailLogsProps {
  manufacturerId: string
  orderId?: string
  className?: string
}

interface EmailLog {
  id: string
  date_created: string
  email_address: string
  subject: string
  communication_method: string
  status: string
  error_message?: string
  message?: string
}

export function ManufacturerEmailLogs({ manufacturerId, orderId, className }: ManufacturerEmailLogsProps) {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!manufacturerId) {
        throw new Error("Manufacturer ID is required")
      }

      const supabase = getSupabaseClient()

      // Base query with some filters
      let query = supabase
        .from("manufacturer_email_logs")
        .select("*")
        .eq("manufacturer_id", manufacturerId)
        .order("date_created", { ascending: false })

      // Add order ID filter if provided
      if (orderId) {
        query = query.eq("order_id", orderId)
      }

      // Execute the query
      const { data, error: fetchError } = await query

      if (fetchError) {
        log(LogLevel.ERROR, "ManufacturerEmailLogs.fetchLogs", "Error fetching email logs", fetchError)
        throw new Error(fetchError.message)
      }

      // If no logs found in manufacturer_email_logs, try manufacturer_communication_logs
      if (!data || data.length === 0) {
        log(
          LogLevel.INFO,
          "ManufacturerEmailLogs.fetchLogs",
          "No logs found in manufacturer_email_logs, trying manufacturer_communication_logs",
        )

        let communicationQuery = supabase
          .from("manufacturer_communication_logs")
          .select("*")
          .eq("manufacturer_id", manufacturerId)
          .eq("communication_method", "email")
          .order("date_created", { ascending: false })

        if (orderId) {
          communicationQuery = communicationQuery.eq("purchase_order_id", orderId)
        }

        const { data: communicationData, error: communicationError } = await communicationQuery

        if (communicationError) {
          log(
            LogLevel.ERROR,
            "ManufacturerEmailLogs.fetchLogs",
            "Error fetching communication logs",
            communicationError,
          )
          throw new Error(communicationError.message)
        }

        setLogs(communicationData || [])
      } else {
        setLogs(data)
      }
    } catch (err: any) {
      log(LogLevel.ERROR, "ManufacturerEmailLogs.fetchLogs", "Error fetching email logs", err)
      setError(err.message || "Failed to load email logs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (manufacturerId) {
      fetchLogs()
    } else {
      setLogs([])
      setIsLoading(false)
    }
  }, [manufacturerId, orderId])

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus === "success" || normalizedStatus === "sent") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Success</span>
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
        <XCircle className="h-3.5 w-3.5" />
        <span>Failed</span>
      </Badge>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Communication History
          </CardTitle>
          <CardDescription>Record of all emails sent to this manufacturer</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center p-4 text-red-500">{error}</div>
        ) : isLoading ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center p-4 text-muted-foreground">No email communications found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium whitespace-nowrap">{formatDate(log.date_created)}</TableCell>
                    <TableCell>{log.email_address}</TableCell>
                    <TableCell>{log.subject}</TableCell>
                    <TableCell>
                      {getStatusBadge(log.status)}
                      {log.error_message && (
                        <div className="mt-1 text-xs text-red-600 max-w-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
