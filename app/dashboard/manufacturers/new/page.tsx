import { ManufacturerForm } from "@/components/manufacturers/manufacturer-form"

export default function NewManufacturerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Add New Manufacturer</h1>
      <ManufacturerForm />
    </div>
  )
}
