import { notFound } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Pencil, PlusCircle, PercentIcon } from "lucide-react"
import { CustomerContactsSection } from "@/components/customers/customer-contacts-section"
import { CustomerOrdersList } from "@/components/customers/customer-orders-list"
import { CustomerCommunicationLogs } from "@/components/customers/customer-communication-logs"

export default async function CustomerDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  // Fetch the customer details
  const { data: customer, error } = await supabase.from("customers").select("*").eq("id", params.id).single()

  if (error || !customer) {
    console.error("Error fetching customer:", error)
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/dashboard/customers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{customer.customer_name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Replace the Create Order button with Volume Rebate button */}
          <Link href={`/dashboard/customers/${params.id}/rebates`}>
            <Button variant="default">
              <PercentIcon className="mr-2 h-4 w-4" />
              Volume Rebate
            </Button>
          </Link>
          <Link href={`/dashboard/customers/${params.id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Customer
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Basic customer details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Customer Type</div>
              <div>{customer.customer_type}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div>{customer.email || "Not provided"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Phone</div>
              <div>{customer.phone_number || "Not provided"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Address</div>
              <div className="whitespace-pre-wrap">{customer.address || "Not provided"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Date Created</div>
              <div>{new Date(customer.date_created).toLocaleDateString()}</div>
            </div>
          </CardContent>
        </Card>

        <CustomerContactsSection customerId={params.id} />
      </div>

      {/* Add the new Communication Logs component */}
      <CustomerCommunicationLogs customerId={params.id} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Orders</CardTitle>
            <CardDescription>Orders placed by this customer</CardDescription>
          </div>
          {/* Add another Create Order button in the Orders section */}
          <Link href={`/dashboard/customer-orders/new?customer=${params.id}`}>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <CustomerOrdersList customerId={params.id} />
        </CardContent>
      </Card>
    </div>
  )
}
