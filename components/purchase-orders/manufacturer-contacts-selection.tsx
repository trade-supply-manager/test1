"use client"

import { useState, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase-client"

interface ManufacturerContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_number: string | null
}

interface Manufacturer {
  id: string
  manufacturer_name: string
  email: string | null
  phone_number: string | null
}

interface ManufacturerContactsSelectionProps {
  manufacturerId: string
  selectedContactIds: string[]
  includePrimaryContact: boolean
  onSelectionChange: (contactIds: string[], includePrimaryContact: boolean) => void
}

export function ManufacturerContactsSelection({
  manufacturerId,
  selectedContactIds,
  includePrimaryContact,
  onSelectionChange,
}: ManufacturerContactsSelectionProps) {
  const [contacts, setContacts] = useState<ManufacturerContact[]>([])
  const [primaryContact, setPrimaryContact] = useState<ManufacturerContact | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    async function fetchContacts() {
      if (!manufacturerId) {
        setContacts([])
        setPrimaryContact(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // First, fetch the manufacturer to get primary contact info
        const { data: manufacturerData, error: manufacturerError } = await supabase
          .from("manufacturers")
          .select("id, manufacturer_name, email, phone_number")
          .eq("id", manufacturerId)
          .single()

        if (manufacturerError) {
          console.error("Error fetching manufacturer:", manufacturerError)
          return
        }

        // Then fetch additional contacts
        const { data: contactsData, error: contactsError } = await supabase
          .from("manufacturer_contacts")
          .select("*")
          .eq("manufacturer_id", manufacturerId)
          .eq("is_archived", false)
          .order("last_name")

        if (contactsError) {
          console.error("Error fetching manufacturer contacts:", contactsError)
          return
        }

        // Create a primary contact object from manufacturer data if email exists
        const primary = manufacturerData.email
          ? {
              id: `primary-${manufacturerData.id}`,
              contact_name: `${manufacturerData.manufacturer_name} (Primary)`,
              email: manufacturerData.email,
              phone: manufacturerData.phone_number || "",
              is_primary: true,
            }
          : null

        // Format additional contacts
        const additionalContacts = contactsData.map((contact) => ({
          id: contact.id,
          contact_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
          email: contact.email || "",
          phone: contact.phone_number || "",
          is_primary: false,
        }))

        setPrimaryContact(primary)
        setContacts(additionalContacts)
      } catch (error) {
        console.error("Error in fetchContacts:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchContacts()
  }, [manufacturerId, supabase])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allContactIds = contacts.map((contact) => contact.id)
      onSelectionChange(allContactIds, includePrimaryContact)
    } else {
      onSelectionChange([], includePrimaryContact)
    }
  }

  const handleContactChange = (contactId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedContactIds, contactId], includePrimaryContact)
    } else {
      onSelectionChange(
        selectedContactIds.filter((id) => id !== contactId),
        includePrimaryContact,
      )
    }
  }

  const handlePrimaryContactChange = (checked: boolean) => {
    onSelectionChange(selectedContactIds, checked)
  }

  if (loading) {
    return <div className="text-center p-4">Loading contacts...</div>
  }

  if (!manufacturerId) {
    return <div className="text-center p-4">Please select a manufacturer to view contacts.</div>
  }

  if (primaryContact === null && contacts.length === 0) {
    return <div className="text-center p-4">No contacts found for this manufacturer.</div>
  }

  return (
    <div className="space-y-4">
      {primaryContact && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`primary-${primaryContact.id}`}
              checked={includePrimaryContact}
              onCheckedChange={(checked) => handlePrimaryContactChange(checked as boolean)}
            />
            <Label htmlFor={`primary-${primaryContact.id}`} className="flex items-center">
              <span className="font-medium">{primaryContact.contact_name}</span>
              <span className="ml-2 text-amber-500">★</span>
            </Label>
          </div>
          <div className="pl-6 text-sm text-muted-foreground">
            <div>{primaryContact.email}</div>
            {primaryContact.phone && <div>{primaryContact.phone}</div>}
            <div className="text-xs">Primary contact from manufacturer record</div>
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="select-all-contacts"
              checked={contacts.length > 0 && selectedContactIds.length === contacts.length}
              onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
            />
            <Label htmlFor="select-all-contacts">Select All Additional Contacts</Label>
          </div>

          <div className="space-y-4 pl-6">
            {contacts.map((contact) => (
              <div key={contact.id} className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`contact-${contact.id}`}
                    checked={selectedContactIds.includes(contact.id)}
                    onCheckedChange={(checked) => handleContactChange(contact.id, checked as boolean)}
                  />
                  <Label htmlFor={`contact-${contact.id}`}>{contact.contact_name || "Unnamed Contact"}</Label>
                </div>
                <div className="pl-6 text-sm text-muted-foreground">
                  <div>{contact.email}</div>
                  {contact.phone && <div>{contact.phone}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
