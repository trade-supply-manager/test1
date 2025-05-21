import { CustomerForm } from "@/components/customers/customer-form"

export const dynamic = "force-dynamic"

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Add New Customer</h1>
      <CustomerForm />
    </div>
  )
}
