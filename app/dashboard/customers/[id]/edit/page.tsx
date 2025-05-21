import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { CustomerForm } from "@/components/customers/customer-form"

export default async function EditCustomerPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createServerComponentClient({ cookies })

  // Fetch the customer data
  const { data: customer, error } = await supabase.from("customers").select("*").eq("id", params.id).single()

  if (error || !customer) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Edit Customer</h1>
      <CustomerForm customerId={params.id} initialData={customer} />
    </div>
  )
}
