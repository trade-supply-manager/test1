import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { EmployeeForm } from "@/components/employees/employee-form"

export default async function NewEmployeePage() {
  const supabase = createServerComponentClient({ cookies })

  // Check if we have a session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If no session, redirect to login
  if (!session) {
    redirect("/auth/login")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Add New Employee</h1>
      <EmployeeForm />
    </div>
  )
}
