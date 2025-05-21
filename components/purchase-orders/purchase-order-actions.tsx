"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getSupabaseClient } from "@/lib/supabase-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { Archive, ChevronDown, Eye, Pencil, Receipt, Trash2, Undo, Settings } from "lucide-react"

interface PurchaseOrderActionsProps {
  purchaseOrderId: string
  isArchived?: boolean
  className?: string
  useGearIcon?: boolean
}

export function PurchaseOrderActions({
  purchaseOrderId,
  isArchived = false,
  className = "",
  useGearIcon = false,
}: PurchaseOrderActionsProps) {
  const router = useRouter()
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const supabase = getSupabaseClient()

  const handleArchive = async () => {
    try {
      const { error } = await supabase.from("purchase_orders").update({ is_archived: true }).eq("id", purchaseOrderId)

      if (error) throw error

      toast({
        title: "Purchase order archived",
        description: "The purchase order has been archived successfully.",
      })

      router.refresh()
    } catch (error) {
      console.error("Error archiving purchase order:", error)
      toast({
        title: "Error",
        description: "Failed to archive the purchase order. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsArchiveDialogOpen(false)
    }
  }

  const handleRestore = async () => {
    try {
      const { error } = await supabase.from("purchase_orders").update({ is_archived: false }).eq("id", purchaseOrderId)

      if (error) throw error

      toast({
        title: "Purchase order restored",
        description: "The purchase order has been restored successfully.",
      })

      router.refresh()
    } catch (error) {
      console.error("Error restoring purchase order:", error)
      toast({
        title: "Error",
        description: "Failed to restore the purchase order. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRestoreDialogOpen(false)
    }
  }

  const handleDelete = async () => {
    try {
      // First delete related purchase order items
      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("purchase_order_id", purchaseOrderId)

      if (itemsError) throw itemsError

      // Then delete the purchase order
      const { error } = await supabase.from("purchase_orders").delete().eq("id", purchaseOrderId)

      if (error) throw error

      toast({
        title: "Purchase order deleted",
        description: "The purchase order has been permanently deleted.",
      })

      router.refresh()
      // Navigate back to the purchase orders list after deletion
      router.push("/dashboard/purchase-orders")
    } catch (error) {
      console.error("Error deleting purchase order:", error)
      toast({
        title: "Error",
        description: "Failed to delete the purchase order. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {useGearIcon ? (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4 text-black" />
            </Button>
          ) : (
            <Button variant="outline" className={className}>
              Actions
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/purchase-orders/${purchaseOrderId}`}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>

          {!isArchived && (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/purchase-orders/${purchaseOrderId}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Order
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem asChild>
            <Link href={`/dashboard/purchase-orders/${purchaseOrderId}/pdf`} target="_blank">
              <Receipt className="mr-2 h-4 w-4" />
              Invoice
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {isArchived ? (
            <>
              <DropdownMenuItem onClick={() => setIsRestoreDialogOpen(true)}>
                <Undo className="mr-2 h-4 w-4" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => setIsArchiveDialogOpen(true)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this purchase order? It will be hidden from the main list but can be
              restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this purchase order? It will be visible in the main list again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this purchase order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
