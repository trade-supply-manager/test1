import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ManufacturerTable } from "@/components/manufacturers/manufacturer-table"
import { PlusCircle } from "lucide-react"

export default async function ManufacturersPage() {
  const supabase = createServerComponentClient({ cookies })

  const { data: manufacturers } = await supabase.from("manufacturers").select("*").order("manufacturer_name")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manufacturers</h1>
        <Link href="/dashboard/manufacturers/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Manufacturer
          </Button>
        </Link>
      </div>

      <ManufacturerTable manufacturers={manufacturers || []} />
    </div>
  )
}
