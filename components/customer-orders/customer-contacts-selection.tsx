"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseClient } from "@/lib/supabase-client"

// Updated interface to match the actual schema
interface CustomerContact {
  id: string
  customer_id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  is_archived: boolean
  date_created: string
  date_last_updated: string
  created_by_user_id: string
  updated_by_user_id: string | null
}

interface CustomerContactsSelectionProps {
  customerId: string
  onSelectedContactsChange: (contactIds: string[]) => void
}

export function CustomerContactsSelection({ customerId, onSelectedContactsChange }: CustomerContactsSelectionProps) {
  const [contacts, setContacts] = useState<CustomerContact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = getSupabaseClient()

  // Fetch customer contacts when customerId changes
  useEffect(() => {
    async function fetchContacts() {
      if (!customerId) {
        setContacts([])
        setSelectedContacts([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from("customer_contacts")
          .select("*")
          .eq("customer_id", customerId)
          .eq("is_archived", false) // Using is_archived instead of is_deleted
          .order("last_name") // Order by last_name instead of contact_name

        if (error) {
          console.error("Error fetching customer contacts:", error)
          throw error
        }

        const contactsWithEmail = data.filter((contact) => contact.email)
        setContacts(contactsWithEmail)

        // Select all contacts by default
        const allContactIds = contactsWithEmail.map((contact) => contact.id)
        setSelectedContacts(allContactIds)
        onSelectedContactsChange(allContactIds)
      } catch (error) {
        console.error("Error in fetchContacts:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchContacts()
  }, [customerId, supabase, onSelectedContactsChange])

  const handleCheckboxChange = (contactId: string, checked: boolean) => {
    let updatedSelection: string[]

    if (checked) {
      updatedSelection = [...selectedContacts, contactId]
    } else {
      updatedSelection = selectedContacts.filter((id) => id !== contactId)
    }

    setSelectedContacts(updatedSelection)
    onSelectedContactsChange(updatedSelection)
  }

  // Helper function to get full name
  const getFullName = (contact: CustomerContact) => {
    return `${contact.first_name} ${contact.last_name}`.trim()
  }

  if (isLoading) {
    return <div className="py-4 text-center text-gray-500">Loading contacts...</div>
  }

  if (contacts.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500">No contacts with email addresses found for this customer.</div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Select contacts to receive email notification</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Notify</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedContacts.includes(contact.id)}
                    onCheckedChange={(checked) => handleCheckboxChange(contact.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell>{getFullName(contact)}</TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.phone_number || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
