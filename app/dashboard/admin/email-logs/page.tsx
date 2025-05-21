import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle } from "lucide-react"

// Add export const dynamic = 'force-dynamic' to prevent static generation
export const dynamic = "force-dynamic"

export default async function EmailLogsPage() {
  const supabase = createServerComponentClient({ cookies })

  // Fetch email logs
  const { data: logs, error } = await supabase
    .from("email_logs")
    .select("*")
    .order("date_created", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Error fetching email logs:", error)
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Email Logs</h1>
      <p className="text-gray-500 mb-6">View the history of emails sent from the system</p>

      <Card>
        <CardHeader>
          <CardTitle>Recent Emails</CardTitle>
          <CardDescription>Showing the last 100 email activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Recipient</th>
                  <th className="text-left py-3 px-4">Subject</th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{format(new Date(log.date_created), "MMM d, yyyy h:mm a")}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="capitalize">
                          {log.email_type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{log.recipient}</td>
                      <td className="py-3 px-4">{log.subject}</td>
                      <td className="py-3 px-4">
                        {log.success ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span>Sent</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span>Failed</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      No email logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
