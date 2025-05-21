"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ManufacturerContactsSection } from "@/components/manufacturers/manufacturer-contacts-section"
import { getCurrentTimestamp } from "@/lib/utils"

interface ManufacturerFormProps {
  manufacturerId?: string
  initialData?: any
}

export function ManufacturerForm({ manufacturerId, initialData }: ManufacturerFormProps = {}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  const isEditing = !!manufacturerId

  const [formData, setFormData] = useState({
    manufacturer_name: "",
    email: "",
    phone_number: "",
    address: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        manufacturer_name: initialData.manufacturer_name || "",
        email: initialData.email || "",
        phone_number: initialData.phone_number || "",
        address: initialData.address || "",
      })
    }
  }, [initialData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Fix: Check if the target is not the form to prevent unintended submissions
    if (e.target !== e.currentTarget) {
      return
    }

    setIsSubmitting(true)

    try {
      const timestamp = getCurrentTimestamp()
      const userId = (await supabase.auth.getUser()).data.user?.id
      let newManufacturerId = manufacturerId || ""

      if (isEditing) {
        // Update existing manufacturer
        const { error } = await supabase
          .from("manufacturers")
          .update({
            manufacturer_name: formData.manufacturer_name,
            email: formData.email || null,
            phone_number: formData.phone_number || null,
            address: formData.address || null,
            date_last_updated: timestamp,
            updated_by_user_id: userId,
          })
          .eq("id", manufacturerId)

        if (error) throw error

        toast({
          title: "Manufacturer updated",
          description: "The manufacturer has been updated successfully.",
        })
      } else {
        // Create new manufacturer
        newManufacturerId = uuidv4()
        const { error } = await supabase.from("manufacturers").insert({
          id: newManufacturerId,
          manufacturer_name: formData.manufacturer_name,
          email: formData.email || null,
          phone_number: formData.phone_number || null,
          address: formData.address || null,
          date_created: timestamp,
          date_last_updated: timestamp,
          created_by_user_id: userId,
          is_archived: false,
        })

        if (error) throw error

        toast({
          title: "Manufacturer created",
          description: "The manufacturer has been created successfully.",
        })
      }

      // Fix: Only redirect if we're not editing or if we're creating a new manufacturer
      if (!isEditing) {
        router.push(`/dashboard/manufacturers/${newManufacturerId}`)
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while saving the manufacturer",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Manufacturer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="manufacturer_name">Manufacturer Name *</Label>
              <Input
                id="manufacturer_name"
                name="manufacturer_name"
                value={formData.manufacturer_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" value={formData.address} onChange={handleChange} rows={3} />
            </div>
          </div>
        </CardContent>
      </Card>

      {isEditing && <ManufacturerContactsSection manufacturerId={manufacturerId} />}

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/manufacturers")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEditing ? "Update Manufacturer" : "Create Manufacturer"}
        </Button>
      </div>
    </form>
  )
}
