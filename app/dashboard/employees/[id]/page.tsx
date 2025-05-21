import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { ArrowLeft, Mail, Phone, Edit, UserMinus, UserCheck } from "lucide-react"

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  // Check if we have a session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If no session, redirect to login
  if (!session) {
    redirect("/auth/login")
  }

  // Fetch employee data
  const { data: employee, error } = await supabase.from("employees").select("*").eq("id", params.id).single()

  if (error || !employee) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/dashboard/employees">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{employee.employee_name}</h1>
          <Badge variant={employee.is_active ? "success" : "secondary"}>
            {employee.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex space-x-2">
          <Link href={`/dashboard/employees/${employee.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Link href={`/dashboard/employees/${employee.id}/${employee.is_active ? "deactivate" : "activate"}`}>
            <Button variant={employee.is_active ? "destructive" : "default"}>
              {employee.is_active ? (
                <>
                  <UserMinus className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Department</p>
                <p>{employee.department || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Role</p>
                <p>{employee.role || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Hire Date</p>
                <p>{employee.hire_date ? formatDate(employee.hire_date) : "Not specified"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {employee.email && (
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-500" />
                  <a href={`mailto:${employee.email}`} className="text-blue-600 hover:underline">
                    {employee.email}
                  </a>
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-gray-500" />
                  <a href={`tel:${employee.phone}`} className="text-blue-600 hover:underline">
                    {employee.phone}
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Employee ID</p>
              <p className="font-mono text-sm">{employee.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Created</p>
              <p>{formatDate(employee.date_created)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Last Updated</p>
              <p>{employee.date_last_updated ? formatDate(employee.date_last_updated) : "Never"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
