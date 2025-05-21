import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { CustomerTable } from "@/components/customers/customer-table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

// Add dynamic export to prevent static generation attempts
export const dynamic = "force-dynamic"

export default async function CustomersPage() {
  const supabase = createServerComponentClient({ cookies })

  const { data: customers } = await supabase.from("customers").select("*").order("customer_name")

  // Instead of passing the function, we'll pre-process the data on the server
  const customersWithAvatars = (customers || []).map((customer) => ({
    ...customer,
    avatarUrl: customer.imageUrl || "/placeholder.svg",
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Link href="/dashboard/customers/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </div>

      {/* Pass the pre-processed data to the CustomerTable component */}
      <CustomerTable customers={customersWithAvatars} />
    </div>
  )
}
