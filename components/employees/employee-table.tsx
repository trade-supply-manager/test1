"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { MoreVertical, Search, Eye, Edit, UserMinus, UserCheck, Mail, Phone } from "lucide-react"

interface Employee {
  id: string
  employee_name: string
  email: string | null
  phone: string | null
  department: string | null
  role: string | null
  hire_date: string | null
  is_active: boolean | null
  user_id: string | null
  date_created: string
  date_last_updated: string | null
}

interface EmployeeTableProps {
  employees: Employee[]
}

export function EmployeeTable({ employees }: EmployeeTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      (employee.employee_name && employee.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (employee.email && employee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (employee.department && employee.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (employee.role && employee.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (employee.phone && employee.phone.includes(searchTerm))

    const matchesActiveFilter = showInactive ? true : employee.is_active !== false

    return matchesSearch && matchesActiveFilter
  })

  const toggleActiveStatus = async (id: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          is_active: !currentStatus,
          date_last_updated: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) throw error

      toast({
        title: currentStatus ? "Employee deactivated" : "Employee activated",
        description: currentStatus
          ? "The employee has been deactivated successfully."
          : "The employee has been activated successfully.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while updating the employee",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search employees..."
            className="pl-8 w-full sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => setShowInactive(!showInactive)}>
          {showInactive ? "Hide Inactive" : "Show Inactive"}
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Hire Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No employees found
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => {
                return (
                  <TableRow key={employee.id} className={employee.is_active === false ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">{employee.employee_name}</TableCell>
                    <TableCell>{employee.department || "-"}</TableCell>
                    <TableCell>{employee.role || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{employee.email || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{employee.phone || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {employee.hire_date ? formatDate(employee.hire_date) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.is_active ? "success" : "secondary"}>
                        {employee.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Employee Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/employees/${employee.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/employees/${employee.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Employee
                            </Link>
                          </DropdownMenuItem>
                          {employee.email && (
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${employee.email}`}>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </a>
                            </DropdownMenuItem>
                          )}
                          {employee.phone && (
                            <DropdownMenuItem asChild>
                              <a href={`tel:${employee.phone}`}>
                                <Phone className="h-4 w-4 mr-2" />
                                Call
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleActiveStatus(employee.id, employee.is_active)}>
                            {employee.is_active ? (
                              <>
                                <UserMinus className="h-4 w-4 mr-2" />
                                Deactivate Employee
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Activate Employee
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
