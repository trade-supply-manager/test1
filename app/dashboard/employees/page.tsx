import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EmployeeTable } from "@/components/employees/employee-table"
import { UserPlus } from "lucide-react"

export default async function EmployeesPage() {
  const supabase = createServerComponentClient({ cookies })

  // Check if we have a session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If no session, redirect to login
  if (!session) {
    redirect("/auth/login")
  }

  // Fetch employees data
  const { data: employees, error } = await supabase
    .from("employees")
    .select("*")
    .order("employee_name", { ascending: true })

  if (error) {
    console.error("Error fetching employees:", error)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Employees</h1>
        <Link href="/dashboard/employees/new">
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </Link>
      </div>

      <EmployeeTable employees={employees || []} />
    </div>
  )
}
