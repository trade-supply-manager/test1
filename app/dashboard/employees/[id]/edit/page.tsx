import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { EmployeeForm } from "@/components/employees/employee-form"

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
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
      <h1 className="text-3xl font-bold">Edit Employee</h1>
      <EmployeeForm employee={employee} />
    </div>
  )
}
