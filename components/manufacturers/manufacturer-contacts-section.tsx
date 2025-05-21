"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { PlusCircle, Pencil, Archive, RotateCcw, Trash2, Loader2 } from "lucide-react"
import { getCurrentTimestamp } from "@/lib/utils"

interface ManufacturerContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_number: string | null
  manufacturer_id: string
  is_archived?: boolean | null
  is_deleted?: boolean | null // Add this field to handle soft deletes
  date_created: string | null
  date_last_updated: string | null
}

interface ManufacturerContactsSectionProps {
  manufacturerId: string
}

export function ManufacturerContactsSection({ manufacturerId }: ManufacturerContactsSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const [contacts, setContacts] = useState<ManufacturerContact[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentContact, setCurrentContact] = useState<Partial<ManufacturerContact> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<ManufacturerContact | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Convert fetchContacts to useCallback to prevent unnecessary re-renders
  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    try {
      console.log("Fetching contacts for manufacturer:", manufacturerId)

      // Modified query to exclude deleted contacts
      const { data, error } = await supabase
        .from("manufacturer_contacts")
        .select("*")
        .eq("manufacturer_id", manufacturerId)
        .is("is_deleted", null) // Only fetch contacts that are not deleted
        .order("first_name")

      if (error) {
        console.error("Error fetching contacts:", error)
        throw error
      }

      console.log("Fetched contacts:", data)
      setContacts(data || [])
    } catch (error: any) {
      console.error("Error in fetchContacts:", error)
      toast({
        variant: "destructive",
        title: "Error fetching contacts",
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }, [manufacturerId, supabase, toast])

  // Use refreshTrigger in the dependency array to force refresh when needed
  useEffect(() => {
    fetchContacts()
  }, [fetchContacts, refreshTrigger])

  const handleOpenDialog = (e?: React.MouseEvent, contact?: ManufacturerContact) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (contact) {
      setCurrentContact(contact)
      setIsEditing(true)
    } else {
      setCurrentContact({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        manufacturer_id: manufacturerId,
      })
      setIsEditing(false)
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setCurrentContact(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCurrentContact((prev) => (prev ? { ...prev, [name]: value } : null))
  }

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentContact) return

    setIsSubmitting(true)
    try {
      const timestamp = getCurrentTimestamp()
      const userId = (await supabase.auth.getUser()).data.user?.id

      if (isEditing && currentContact.id) {
        // Update existing contact
        const { error } = await supabase
          .from("manufacturer_contacts")
          .update({
            first_name: currentContact.first_name,
            last_name: currentContact.last_name,
            email: currentContact.email,
            phone_number: currentContact.phone_number,
            date_last_updated: timestamp,
            updated_by_user_id: userId,
          })
          .eq("id", currentContact.id)

        if (error) throw error

        toast({
          title: "Contact updated",
          description: "The contact has been updated successfully.",
        })
      } else {
        // Create new contact
        const newContactId = uuidv4()
        const { error } = await supabase.from("manufacturer_contacts").insert({
          id: newContactId,
          first_name: currentContact.first_name,
          last_name: currentContact.last_name,
          email: currentContact.email,
          phone_number: currentContact.phone_number,
          manufacturer_id: manufacturerId,
          date_created: timestamp,
          date_last_updated: timestamp,
          created_by_user_id: userId,
          is_archived: false,
          is_deleted: null, // Explicitly set to null for new contacts
        })

        if (error) throw error

        toast({
          title: "Contact added",
          description: "The contact has been added successfully.",
        })
      }

      handleCloseDialog()
      // Trigger a refresh by incrementing the refreshTrigger
      setRefreshTrigger((prev) => prev + 1)
    } catch (error: any) {
      console.error("Error in handleSubmitContact:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while saving the contact",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleArchiveStatus = async (id: string, currentStatus: boolean | null) => {
    try {
      const timestamp = getCurrentTimestamp()
      const userId = (await supabase.auth.getUser()).data.user?.id

      const { error } = await supabase
        .from("manufacturer_contacts")
        .update({
          is_archived: !currentStatus,
          date_last_updated: timestamp,
          updated_by_user_id: userId,
        })
        .eq("id", id)

      if (error) throw error

      toast({
        title: currentStatus ? "Contact restored" : "Contact archived",
        description: currentStatus
          ? "The contact has been restored successfully."
          : "The contact has been archived successfully.",
      })

      // Trigger a refresh by incrementing the refreshTrigger
      setRefreshTrigger((prev) => prev + 1)
    } catch (error: any) {
      console.error("Error in toggleArchiveStatus:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while updating the contact",
      })
    }
  }

  const handleOpenDeleteDialog = (e: React.MouseEvent, contact: ManufacturerContact) => {
    e.preventDefault()
    e.stopPropagation()
    setContactToDelete(contact)
    setIsDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false)
    setContactToDelete(null)
  }

  const handleDeleteContact = async () => {
    if (!contactToDelete) return

    setIsDeleting(true)
    try {
      console.log("Deleting contact:", contactToDelete.id)

      // First, optimistically update the UI
      const contactId = contactToDelete.id
      setContacts((prevContacts) => prevContacts.filter((contact) => contact.id !== contactId))

      const timestamp = getCurrentTimestamp()
      const userId = (await supabase.auth.getUser()).data.user?.id

      // Instead of trying to delete the record, mark it as deleted using a soft delete approach
      const { error, data } = await supabase
        .from("manufacturer_contacts")
        .update({
          is_deleted: true, // Mark as deleted
          date_last_updated: timestamp,
          updated_by_user_id: userId,
        })
        .eq("id", contactId)
        .select()

      if (error) {
        console.error("Error soft-deleting contact:", error)
        throw error
      }

      console.log("Soft delete operation result:", data)

      toast({
        title: "Contact deleted",
        description: "The contact has been permanently deleted.",
      })

      handleCloseDeleteDialog()

      // Trigger a refresh by incrementing the refreshTrigger after a short delay
      // to ensure the database has processed the deletion
      setTimeout(() => {
        setRefreshTrigger((prev) => prev + 1)
      }, 500)
    } catch (error: any) {
      console.error("Error in handleDeleteContact:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while deleting the contact",
      })
      // Refresh contacts even on error to ensure UI is in sync
      setRefreshTrigger((prev) => prev + 1)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Contact Persons</CardTitle>
            <CardDescription>Manage contact persons for this manufacturer</CardDescription>
          </div>
          <Button type="button" onClick={(e) => handleOpenDialog(e)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No contacts added yet. Click "Add Contact" to add your first contact person.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id} className={contact.is_archived ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {contact.first_name} {contact.last_name}
                      {contact.is_archived && <span className="ml-2 text-xs text-muted-foreground">(Archived)</span>}
                    </TableCell>
                    <TableCell>{contact.email || "-"}</TableCell>
                    <TableCell>{contact.phone_number || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" type="button" onClick={(e) => handleOpenDialog(e, contact)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => toggleArchiveStatus(contact.id, contact.is_archived)}
                        >
                          {contact.is_archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                          <span className="sr-only">{contact.is_archived ? "Restore" : "Archive"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={(e) => handleOpenDeleteDialog(e, contact)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Contact" : "Add New Contact"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitContact}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={currentContact?.first_name || ""}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={currentContact?.last_name || ""}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={currentContact?.email || ""}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  name="phone_number"
                  value={currentContact?.phone_number || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isEditing ? "Update Contact" : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete this contact?</p>
            <p className="font-medium mt-2">
              {contactToDelete?.first_name} {contactToDelete?.last_name}
            </p>
            <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteContact} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
