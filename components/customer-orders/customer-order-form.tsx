// --- START OF FILE customer-order-form.tsx ---

"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { CustomerOrderItems } from "@/components/customer-orders/customer-order-items"
import { formatCurrency, getCurrentTimestamp, calculateInventoryImpact } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, ClipboardList, ShoppingCart, AlertTriangle, Users } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { InventoryImpactTable } from "@/components/customer-orders/inventory-impact-table"
import { getSupabaseClient } from "@/lib/supabase-client"
import { EmailRecipientsTab } from "./email-recipients-tab"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { CustomerCommunicationLogger } from "@/lib/customer-communication-logger"

// Function to generate a styled order name
function generateStyledOrderName(): string {
  // Format: CO-YYYYMMDD-HHMMSS-RANDOM
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "") // YYYYMMDD
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, "") // HHMMSS
  const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString() // 6-digit random number

  return `CO-${datePart}-${timePart}-${randomSuffix}`
}

// Add this UUID validation function at the top of the file
function isValidUUID(id: any): boolean {
  if (typeof id !== "string") {
    return false
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

interface Customer {
  id: string
  customer_name: string
  email: string // Add email field
}

interface ProductVariant {
  id: string
  product_variant_name: string
  product_variant_sku: string
  unit_price: number | null
  quantity: number | null
  is_pallet: boolean | null
  pallets: number | null
  layers: number | null
}

interface Product {
  id: string
  product_name: string
  product_category: string
  unit: string | null
  feet_per_layer: number | null
  layers_per_pallet: number | null
  manufacturer_id: string
  product_variants: ProductVariant[]
}

interface OrderItem {
  id: string
  product_id: string
  variant_id: string
  product_name: string
  variant_name: string
  unit_price: number
  quantity: number
  discount_percentage: number
  discount: number
  total_order_item_value: number
  is_pallet: boolean
  pallets: number | null
  layers: number | null
  unit: string | null
  feet_per_layer: number | null
  layers_per_pallet: number | null
  isTransient?: boolean // Flag to mark items that were added and then deleted in the same session
}

interface InventoryChange {
  variant_id: string
  variant_name: string
  product_name: string
  unit: string | null
  current_quantity: number
  current_pallets: number | null
  current_layers: number | null
  change_quantity: number
  change_pallets: number | null
  change_layers: number | null
  new_quantity: number
  new_pallets: number
  new_layers: number
  warning_threshold: number | null
  critical_threshold: number | null
  feet_per_layer?: number | null
  layers_per_pallet?: number | null
  is_deleted?: boolean // Flag to indicate if this item was deleted from the order
  isTransient?: boolean // Flag to indicate if this item was added and deleted in the same session
}

interface CustomerOrderFormProps {
  customers: Customer[]
  products: Product[]
  preselectedCustomerId?: string
  orderId?: string
  initialData?: any
}

// Default conversion rates (same as in product_variants_section.tsx)
const DEFAULT_FEET_PER_LAYER = 100 // Default square feet per layer
const DEFAULT_LAYERS_PER_PALLET = 10 // Default layers per pallet

// Function to send order confirmation email via API
async function sendOrderConfirmationEmail(
  orderId: string,
  selectedContactIds?: string[],
  selectedEmployeeIds?: string[],
  includePrimaryContact = true,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate orderId is a string and a valid UUID
    if (typeof orderId !== "string") {
      const errorMsg = `Invalid orderId type: ${typeof orderId}. Expected string.`
      console.error(`❌ ${errorMsg}`)
      return { success: false, error: errorMsg }
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(orderId)) {
      const errorMsg = `Invalid orderId format: "${orderId}"`
      console.error(`❌ ${errorMsg}`)
      return { success: false, error: errorMsg }
    }

    console.log(`📧 Sending order confirmation email for order ${orderId}`)
    console.log(
      `📧 Recipients: ${selectedContactIds?.length || 0} contacts, ${selectedEmployeeIds?.length || 0} employees, includePrimary: ${includePrimaryContact}`,
    )
    console.log(`📧 Contact IDs: ${JSON.stringify(selectedContactIds)}`)
    console.log(`📧 Employee IDs: ${JSON.stringify(selectedEmployeeIds)}`)

    // Ensure arrays are properly initialized
    const contactIds = Array.isArray(selectedContactIds) ? selectedContactIds : []
    const employeeIds = Array.isArray(selectedEmployeeIds) ? selectedEmployeeIds : []

    // Validate contact IDs
    const invalidContactIds = contactIds.filter((id) => !uuidRegex.test(id))
    if (invalidContactIds.length > 0) {
      console.warn(`⚠️ Invalid contact ID formats detected: ${invalidContactIds.join(", ")}`)
      // Filter out invalid IDs
      const validContactIds = contactIds.filter((id) => uuidRegex.test(id))
      console.log(`📧 Proceeding with ${validContactIds.length} valid contact IDs`)
      // Update the array
      selectedContactIds = validContactIds
    }

    // Validate employee IDs
    const invalidEmployeeIds = employeeIds.filter((id) => !uuidRegex.test(id))
    if (invalidEmployeeIds.length > 0) {
      console.warn(`⚠️ Invalid employee ID formats detected: ${invalidEmployeeIds.join(", ")}`)
      // Filter out invalid IDs
      const validEmployeeIds = employeeIds.filter((id) => uuidRegex.test(id))
      console.log(`📧 Proceeding with ${validEmployeeIds.length} valid employee IDs`)
      // Update the array
      selectedEmployeeIds = validEmployeeIds
    }

    // Prepare the request payload
    const payload = {
      orderId,
      selectedContactIds: selectedContactIds || [],
      selectedEmployeeIds: selectedEmployeeIds || [],
      includePrimaryContact,
    }

    console.log(`📧 Sending API request with payload:`, JSON.stringify(payload))

    const response = await fetch("/api/email/send-order-confirmation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    // Check if response is ok (status in the range 200-299)
    if (!response.ok) {
      // Try to parse as JSON first
      let errorMessage: string
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || `Server responded with status: ${response.status}`
        console.error(`❌ Email API error response:`, errorData)
      } catch (parseError) {
        // If JSON parsing fails, use text or status
        try {
          errorMessage = await response.text()
          console.error(`❌ Email API error text:`, errorMessage)
        } catch (textError) {
          errorMessage = `Server responded with status: ${response.status}`
          console.error(`❌ Email API error status:`, response.status)
        }
      }

      console.error(`❌ Email sending failed: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage,
      }
    }

    // For successful responses, safely parse JSON
    try {
      const result = await response.json()
      console.log("✅ Email sent successfully:", result)
      return result
    } catch (parseError) {
      // If JSON parsing fails for a successful response
      console.warn("⚠️ Could not parse successful response:", parseError)
      return {
        success: true,
        error: "Warning: Could not parse server response, but operation may have succeeded.",
      }
    }
  } catch (error: any) {
    console.error("❌ Error sending order confirmation email:", error)
    return {
      success: false,
      error: error.message || "Failed to send order confirmation email",
    }
  }
}

export function CustomerOrderForm({
  customers,
  products,
  preselectedCustomerId,
  orderId,
  initialData,
}: CustomerOrderFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient() // Use the singleton Supabase client

  // Validate orderId prop is a string UUID or undefined
  useEffect(() => {
    if (orderId !== undefined && !isValidUUID(orderId)) {
      console.error(`CustomerOrderForm received invalid orderId: ${JSON.stringify(orderId)}`)
      toast({
        variant: "destructive",
        title: "Invalid Order ID",
        description: "The order ID format is invalid. Please contact support.",
      })
    }
  }, [orderId, toast])

  const isEditing = !!orderId && typeof orderId === "string" && isValidUUID(orderId)

  // Debug state to track form initialization
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [initializationError, setInitializationError] = useState<string | null>(null)

  // State for custom time input when needed
  const [customTimeInput, setCustomTimeInput] = useState<string>("")
  const [showCustomTimeInput, setShowCustomTimeInput] = useState(false)

  // Track deleted items for inventory impact calculation
  const [deletedOrderItems, setDeletedOrderItems] = useState<OrderItem[]>([])
  const [originalOrderItems, setOriginalOrderItems] = useState<OrderItem[]>([])

  // Track transient items (added and then deleted in the same session)
  const [transientItemIds, setTransientItemIds] = useState<Set<string>>(new Set())

  // Use a ref to track deleted item IDs to prevent re-addition
  const deletedItemIdsRef = useRef<Set<string>>(new Set())

  // Use a ref to track newly inserted item IDs during a single form submission
  // This avoids React state update batching issues
  const newlyInsertedItemIdsRef = useRef<Set<string>>(new Set())

  // Keep these state variables at the component level
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])

  const [formData, setFormData] = useState({
    order_name: generateStyledOrderName(),
    customer_id: preselectedCustomerId || "",
    status: "Pending",
    payment_status: "Unpaid",
    delivery_method: "Delivery",
    delivery_date: new Date().toISOString(),
    delivery_time: "09:00", // Default time in HH:MM format
    delivery_address: "",
    delivery_instructions: "",
    notes: "",
    tax_rate: 13, // Default tax rate
    discount_percentage: 0, // Default discount percentage
    amount_paid: 0,
    send_email: false,
  })

  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState("details")
  const [inventoryChanges, setInventoryChanges] = useState<InventoryChange[]>([])
  const [isCalculatingInventory, setIsCalculatingInventory] = useState(false)
  const [enableEmailNotifications, setEnableEmailNotifications] = useState<boolean>(initialData?.send_email === true)

  // Flag to prevent re-fetching items after deletion
  const [hasManuallyModifiedItems, setHasManuallyModifiedItems] = useState(false)

  // Ref to track if original order items have been fetched and set
  const originalItemsFetchedRef = useRef(false)
  // Ref to hold formData for stable logging function
  const formDataForLoggingRef = useRef(formData)

  useEffect(() => {
    formDataForLoggingRef.current = formData
  }, [formData])

  // Debug function to log form state (now stable regarding formData changes)
  const logFormState = useCallback(
    (message: string, data?: any) => {
      console.log(`[${isEditing ? "EDIT" : "NEW"}] ${message}`, data || formDataForLoggingRef.current)
    },
    [isEditing], // formDataForLoggingRef.current is accessed directly, ref object is stable
  )

  // Add this function after the logFormState function
  const logDataAdjustments = useCallback((message: string, adjustments: any) => {
    console.log(`[DATA ADJUSTMENTS] ${message}:`, adjustments)
  }, [])

  // Effect to reset states if orderId changes (for robustness, e.g., navigating between edit forms without remount)
  useEffect(() => {
    if (orderId) {
      logFormState(`Order ID changed to: ${orderId}. Resetting relevant states.`)
      originalItemsFetchedRef.current = false
      setHasManuallyModifiedItems(false)
      setOrderItems([])
      setOriginalOrderItems([])
      if (deletedItemIdsRef.current) {
        // Check if ref is initialized
        deletedItemIdsRef.current.clear()
      } else {
        deletedItemIdsRef.current = new Set() // Initialize if somehow not
      }
      setTransientItemIds(new Set())
    }
  }, [orderId, logFormState])

  const fetchOrderItems = useCallback(async () => {
    // Guard 1: Check if orderId is valid and available.
    if (!orderId || !isValidUUID(orderId)) {
      logFormState("fetchOrderItems skipped: Invalid or missing orderId.", { orderId })
      setOrderItems([])
      if (!originalItemsFetchedRef.current) {
        setOriginalOrderItems([])
        originalItemsFetchedRef.current = true
      }
      return
    }

    // Guard 2: If items were manually modified, don't refetch from DB.
    if (hasManuallyModifiedItems) {
      logFormState("fetchOrderItems skipped: Items manually modified.", { orderId })
      return
    }

    logFormState("Fetching order items for order ID:", orderId)

    try {
      const { data: items, error } = await supabase
        .from("customer_order_items")
        .select(`
        customer_order_item_id,
        product_id,
        variant_id,
        unit_price,
        quantity,
        discount_percentage,
        discount,
        total_order_item_value,
        is_pallet,
        pallets,
        layers,
        products (
          product_name,
          unit,
          feet_per_layer,
          layers_per_pallet
        ),
        product_variants (
          product_variant_name
        )
      `)
        .eq("customer_order_id", orderId)
        .eq("is_archived", false)

      if (error) {
        console.error("Error fetching order items:", error)
        toast({ variant: "destructive", title: "Error fetching order items", description: error.message })
        setOrderItems([])
        if (!originalItemsFetchedRef.current) {
          setOriginalOrderItems([])
          originalItemsFetchedRef.current = true
        }
        return
      }

      if (items && items.length > 0) {
        logFormState(`Found ${items.length} order items:`, items)
        const formattedItems: OrderItem[] = items
          .map((item) => ({
            id: item.customer_order_item_id,
            product_id: item.product_id || "",
            variant_id: item.variant_id || "",
            product_name: item.products?.product_name || "",
            variant_name: item.product_variants?.product_variant_name || "",
            unit_price: item.unit_price || 0,
            quantity: item.quantity || 0,
            discount_percentage: item.discount_percentage || 0,
            discount: item.discount || 0,
            total_order_item_value: item.total_order_item_value || 0,
            is_pallet: item.is_pallet || false,
            pallets: item.pallets !== null ? item.pallets : 0,
            layers: item.layers !== null ? item.layers : 0,
            unit: item.products?.unit || null,
            feet_per_layer: item.products?.feet_per_layer || null,
            layers_per_pallet: item.products?.layers_per_pallet || null,
          }))
          .filter((item) => !deletedItemIdsRef.current.has(item.id))

        setOrderItems(formattedItems)
        if (!originalItemsFetchedRef.current) {
          setOriginalOrderItems([...formattedItems])
          originalItemsFetchedRef.current = true
          logFormState("Original order items set.")
        }
      } else {
        logFormState("No order items found or items array is empty.")
        setOrderItems([])
        if (!originalItemsFetchedRef.current) {
          setOriginalOrderItems([])
          originalItemsFetchedRef.current = true
        }
      }
    } catch (error: any) {
      console.error("Error in fetchOrderItems:", error)
      toast({ variant: "destructive", title: "Error fetching order items", description: error.message })
      setOrderItems([])
      if (!originalItemsFetchedRef.current) {
        setOriginalOrderItems([])
        originalItemsFetchedRef.current = true
      }
    }
  }, [orderId, supabase, toast, logFormState, hasManuallyModifiedItems])

  // Initialize form data from initialData
  useEffect(() => {
    if (initialData && !isInitialized) {
      try {
        setIsLoading(true)
        logFormState("Initializing form with data:", initialData)

        const customerId = initialData.customer_id ? String(initialData.customer_id) : ""
        const customerExists = customers.some((c) => c.id === customerId)
        if (!customerExists && customerId) {
          console.warn(`Customer with ID ${customerId} not found in customers list. Using original ID anyway.`)
        }

        const paymentStatus = initialData.payment_status || "Unpaid"
        const deliveryMethod = initialData.delivery_method || "Delivery"
        const deliveryTime = initialData.delivery_time || "09:00"
        const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/
        const isStandardTimeFormat = timeRegex.test(deliveryTime)

        if (!isStandardTimeFormat && deliveryTime) {
          setShowCustomTimeInput(true)
          setCustomTimeInput(deliveryTime)
        }

        setFormData({
          order_name: initialData.order_name || generateStyledOrderName(),
          customer_id: customerId,
          status: initialData.status || "Pending",
          payment_status: paymentStatus,
          delivery_method: deliveryMethod,
          delivery_date: initialData.delivery_date || new Date().toISOString(),
          delivery_time: deliveryTime,
          delivery_address: initialData.delivery_address || "",
          delivery_instructions: initialData.delivery_instructions || "",
          notes: initialData.notes || "",
          tax_rate:
            initialData.tax_rate !== undefined && !isNaN(Number(initialData.tax_rate))
              ? Number(initialData.tax_rate)
              : 13,
          discount_percentage:
            initialData.discount_percentage !== undefined && !isNaN(Number(initialData.discount_percentage))
              ? Number(initialData.discount_percentage)
              : 0,
          amount_paid:
            initialData.amount_paid !== undefined && !isNaN(Number(initialData.amount_paid))
              ? Number(initialData.amount_paid)
              : 0,
          send_email: initialData.send_email !== false,
        })

        if (initialData.delivery_date) {
          try {
            const parsedDate = new Date(initialData.delivery_date)
            if (!isNaN(parsedDate.getTime())) {
              setDeliveryDate(parsedDate)
              logFormState("Set delivery date:", parsedDate)
            } else {
              console.error("Invalid delivery date format:", initialData.delivery_date)
              setDeliveryDate(new Date())
            }
          } catch (error) {
            console.error("Error parsing delivery date:", error)
            setDeliveryDate(new Date())
          }
        }

        setIsInitialized(true)
        logFormState("Form initialization complete")
      } catch (error: any) {
        console.error("Error initializing form data:", error)
        setInitializationError(error.message || "Error initializing form")
        setIsInitialized(true)
      } finally {
        setIsLoading(false)
      }
    } else if (!initialData && !isInitialized) {
      setIsInitialized(true)
      setIsLoading(false)
    }
  }, [initialData, isInitialized, customers, logFormState])

  // Fetch order items when editing and form is initialized
  useEffect(() => {
    if (isEditing && isInitialized && orderId) {
      fetchOrderItems()
    } else if ((!isEditing || !orderId) && isInitialized) {
      logFormState("Not editing or no valid orderId; ensuring order items are clear.", { isEditing, orderId })
      setOrderItems([])
      setOriginalOrderItems([])
      originalItemsFetchedRef.current = false
    }
  }, [isEditing, isInitialized, orderId, fetchOrderItems, logFormState])

  // Handle item removal from the CustomerOrderItems component
  const handleItemRemoved = useCallback(
    (removedItem: OrderItem) => {
      // Mark this item as manually deleted
      setHasManuallyModifiedItems(true)

      // Add the item ID to the deleted items ref to prevent re-addition
      deletedItemIdsRef.current.add(removedItem.id)

      // Check if this is a transient item (added in this session)
      const isNewItem = removedItem.id.startsWith("new-")

      if (isNewItem) {
        // For new items that were added and then deleted in the same session,
        // mark them as transient so they don't affect inventory calculations (Business Logic #4)
        setTransientItemIds((prev) => {
          const updated = new Set(prev)
          updated.add(removedItem.id)
          return updated
        })

        // Add the transient flag to the item
        const transientItem = { ...removedItem, isTransient: true }

        // Add to deleted items for tracking
        setDeletedOrderItems((prev) => {
          // Check if this item is already in the deleted items list
          if (!prev.some((item) => item.id === removedItem.id)) {
            return [...prev, transientItem]
          }
          return prev
        })
      } else {
        // For existing items, add to deleted items normally (Business Logic #1)
        setDeletedOrderItems((prev) => {
          // Check if this item is already in the deleted items list
          if (!prev.some((item) => item.id === removedItem.id)) {
            return [...prev, removedItem]
          }
          return prev
        })
      }

      // Log the deletion for debugging
      console.log(`Item removed: ${removedItem.id} - ${removedItem.product_name} - ${removedItem.variant_name}`)
      console.log("Current deleted items:", [...deletedItemIdsRef.current])
      console.log("Current transient items:", [...transientItemIds])
    },
    [transientItemIds], // transientItemIds is a dependency for setTransientItemIds updater function
  )

  // Calculate inventory changes whenever order items or deleted items change
  useEffect(() => {
    if (orderItems.length > 0 || deletedOrderItems.length > 0) {
      calculateInventoryChanges()
    } else {
      setInventoryChanges([])
    }
  }, [orderItems, deletedOrderItems]) // calculateInventoryChanges will be re-defined if its own dependencies change.

  // Debug effect to log form state changes
  useEffect(() => {
    if (isEditing) {
      logFormState("Form state updated")
    }
  }, [isEditing, logFormState]) // formData changes are logged via formDataForLoggingRef in logFormState

  // Also update the calculateInventoryChanges function to properly handle negative values
  // Find the calculateInventoryChanges function and replace it with this improved version:

  const calculateInventoryChanges = async () => {
    if (isCalculatingInventory) return
    setIsCalculatingInventory(true)

    try {
      const changes: InventoryChange[] = []

      // Get original order items if editing
      const originalItemsMap: Record<string, { quantity: number; pallets: number | null; layers: number | null }> = {}

      // Use the state `originalOrderItems` which is set once upon fetching.
      if (isEditing && originalOrderItems.length > 0) {
        originalOrderItems.forEach((item) => {
          originalItemsMap[item.variant_id] = {
            quantity: item.quantity || 0,
            pallets: item.pallets,
            layers: item.layers,
          }
        })
      }

      // Process current order items (subtractions from inventory)
      for (const item of orderItems) {
        if (!item.variant_id) continue

        // REMOVED: The following lines were skipping new, unsaved items.
        // if (item.id.startsWith("new-")) {
        //   console.log(`Skipping inventory calculation for new item: ${item.id}`)
        //   continue
        // }

        // Get current variant data
        const { data: variant } = await supabase
          .from("product_variants")
          .select(
            "product_variant_name, quantity, pallets, layers, warning_threshold, critical_threshold, products(product_name, unit, feet_per_layer, layers_per_pallet)",
          )
          .eq("id", item.variant_id)
          .single()

        if (variant) {
          const currentQuantity = variant.quantity || 0
          const currentPallets = variant.pallets || 0
          const currentLayers = variant.layers || 0
          const unit = variant.products?.unit || null
          const isSpecialUnit = unit === "Square Feet" || unit === "Linear Feet"
          const feetPerLayer = variant.products?.feet_per_layer || DEFAULT_FEET_PER_LAYER
          const layersPerPallet = variant.products?.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

          // Calculate change in quantity
          let changeQuantity = Math.ceil(item.quantity)
          let changePallets = isSpecialUnit && item.is_pallet ? Math.floor(item.pallets || 0) : null
          let changeLayers = isSpecialUnit && item.is_pallet ? Math.floor(item.layers || 0) : null

          // If editing an existing item (not a new item in an existing order), adjust for original quantities
          // An item is "existing" if it's part of an order being edited AND it's present in originalItemsMap.
          // New items (item.id.startsWith("new-")) will not be in originalItemsMap.
          if (isEditing && originalItemsMap[item.variant_id] && !item.id.startsWith("new-")) {
            const originalVariantState = originalItemsMap[item.variant_id]
            changeQuantity = Math.ceil(item.quantity) - (originalVariantState.quantity || 0)

            if (isSpecialUnit && item.is_pallet && originalVariantState.pallets !== null) {
              changePallets = Math.floor(item.pallets || 0) - Math.floor(originalVariantState.pallets!)
            }

            if (isSpecialUnit && item.is_pallet && originalVariantState.layers !== null) {
              changeLayers = Math.floor(item.layers || 0) - Math.floor(originalVariantState.layers!)
            }
          }
          // For new orders, or new items in an existing order, changeQuantity, changePallets, changeLayers will be the full item amount.

          // Skip if there's no change (for edited items that ended up with same quantity)
          if (changeQuantity === 0 && (!isSpecialUnit || (changePallets === 0 && changeLayers === 0))) {
            // If it's a new item (item.id.startsWith("new-")), it should always be processed unless its quantity is 0.
            // This check is more for existing items that haven't actually changed.
            if (!item.id.startsWith("new-") || item.quantity === 0) {
              console.log(
                `No change detected for variant ${item.variant_id}, or new item with 0 quantity. Skipping inventory impact preview.`,
              )
              continue
            }
          }

          const isUsingPalletsLayers =
            isSpecialUnit && item.is_pallet && changePallets !== null && changeLayers !== null

          const { newQuantity, newPallets, newLayers } = calculateInventoryImpact(
            currentQuantity,
            currentPallets,
            currentLayers,
            -changeQuantity, // Negate for removal from inventory
            changePallets !== null ? -changePallets : null, // Negate for removal
            changeLayers !== null ? -changeLayers : null, // Negate for removal
            feetPerLayer,
            layersPerPallet,
            isUsingPalletsLayers,
          )

          changes.push({
            variant_id: item.variant_id,
            variant_name: variant.product_variant_name,
            product_name: variant.products?.product_name || "",
            unit,
            current_quantity: currentQuantity,
            current_pallets: isSpecialUnit ? currentPallets : null,
            current_layers: isSpecialUnit ? currentLayers : null,
            change_quantity: changeQuantity, // This is the positive amount representing the order item's demand
            change_pallets: changePallets,
            change_layers: changeLayers,
            new_quantity: newQuantity,
            new_pallets: newPallets,
            new_layers: newLayers,
            warning_threshold: variant.warning_threshold,
            critical_threshold: variant.critical_threshold,
            feet_per_layer: feetPerLayer,
            layers_per_pallet: layersPerPallet,
            is_deleted: false,
            // isTransient is NOT set here, as these are active (though potentially unsaved) items
          })
        }
      }

      // Process deleted items (additions to inventory - Business Logic #1)
      for (const item of deletedOrderItems) {
        if (!item.variant_id) continue

        // Skip transient items (added and then deleted in the same session - Business Logic #4)
        if (transientItemIds.has(item.id)) {
          console.log(`Skipping transient item in inventory calculation: ${item.id}`)
          changes.push({
            // Still push it so InventoryImpactTable can show it as "Transient"
            variant_id: item.variant_id,
            variant_name: item.variant_name,
            product_name: item.product_name,
            unit: item.unit || null,
            current_quantity: 0, // Placeholder, as it won't affect DB
            current_pallets: null,
            current_layers: null,
            change_quantity: 0, // No actual DB change
            change_pallets: null,
            change_layers: null,
            new_quantity: 0, // Placeholder
            new_pallets: 0,
            new_layers: 0,
            warning_threshold: null,
            critical_threshold: null,
            is_deleted: true,
            isTransient: true, // Mark as transient
          })
          continue
        }

        // Get current variant data
        const { data: variant } = await supabase
          .from("product_variants")
          .select(
            "product_variant_name, quantity, pallets, layers, warning_threshold, critical_threshold, products(product_name, unit, feet_per_layer, layers_per_pallet)",
          )
          .eq("id", item.variant_id)
          .single()

        if (variant) {
          const currentQuantity = variant.quantity || 0
          const currentPallets = variant.pallets || 0
          const currentLayers = variant.layers || 0
          const unit = variant.products?.unit || null
          const isSpecialUnit = unit === "Square Feet" || unit === "Linear Feet"
          const feetPerLayer = variant.products?.feet_per_layer || DEFAULT_FEET_PER_LAYER
          const layersPerPallet = variant.products?.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

          // For deleted items, we're adding back to inventory
          const changeQuantity = Math.ceil(item.quantity)
          const changePallets = isSpecialUnit && item.is_pallet ? Math.floor(item.pallets || 0) : null
          const changeLayers = isSpecialUnit && item.is_pallet ? Math.floor(item.layers || 0) : null

          const isUsingPalletsLayers =
            isSpecialUnit && item.is_pallet && changePallets !== null && changeLayers !== null

          const { newQuantity, newPallets, newLayers } = calculateInventoryImpact(
            currentQuantity,
            currentPallets,
            currentLayers,
            changeQuantity, // Positive for addition back to inventory
            changePallets,
            changeLayers,
            feetPerLayer,
            layersPerPallet,
            isUsingPalletsLayers,
          )

          changes.push({
            variant_id: item.variant_id,
            variant_name: item.variant_name, // Use item's variant_name as it was when ordered
            product_name: item.product_name, // Use item's product_name
            unit,
            current_quantity: currentQuantity,
            current_pallets: isSpecialUnit ? currentPallets : null,
            current_layers: isSpecialUnit ? currentLayers : null,
            change_quantity: -changeQuantity, // Negative to indicate addition back (for display purposes, shows as green/plus)
            change_pallets: changePallets !== null ? -changePallets : null,
            change_layers: changeLayers !== null ? -changeLayers : null,
            new_quantity: newQuantity,
            new_pallets: newPallets,
            new_layers: newLayers,
            warning_threshold: variant.warning_threshold,
            critical_threshold: variant.critical_threshold,
            feet_per_layer: feetPerLayer,
            layers_per_pallet: layersPerPallet,
            is_deleted: true, // Mark as deleted for UI display
            isTransient: item.isTransient, // Pass through the transient flag from handleItemRemoved
          })
        }
      }

      setInventoryChanges(changes)
    } catch (error) {
      console.error("Error calculating inventory changes:", error)
    } finally {
      setIsCalculatingInventory(false)
    }
  }

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: Number.parseFloat(value) || 0 }))
  }, [])

  const handleSelectChange = useCallback(
    (name: string, value: string) => {
      logFormState(`Select changed: ${name} = ${value}`)

      // Special handling for delivery_time
      if (name === "delivery_time" && value === "custom") {
        setShowCustomTimeInput(true)
        return
      }

      setFormData((prev) => ({ ...prev, [name]: value }))
    },
    [logFormState],
  )

  const handleCustomTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomTimeInput(value)
    setFormData((prev) => ({ ...prev, delivery_time: value }))
  }, [])

  const handleCheckboxChange = useCallback((name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }, [])

  const handleDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      setDeliveryDate(date)
      setFormData((prev) => ({ ...prev, delivery_date: date.toISOString() }))
    }
  }, [])

  const calculateOrderTotals = useCallback(() => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.total_order_item_value, 0)
    const discountAmount = subtotal * (formData.discount_percentage / 100)
    const discountedSubtotal = subtotal - discountAmount
    const taxAmount = discountedSubtotal * (formData.tax_rate / 100)
    const total = discountedSubtotal + taxAmount

    return {
      subtotal,
      discountAmount,
      discountedSubtotal,
      taxAmount,
      total,
    }
  }, [orderItems, formData.tax_rate, formData.discount_percentage])

  const { subtotal, discountAmount, discountedSubtotal, taxAmount, total } = calculateOrderTotals()

  // Function to check if customer has an email
  const customerHasEmail = useCallback(() => {
    const selectedCustomer = customers.find((c) => c.id === formData.customer_id)
    return !!selectedCustomer?.email
  }, [customers, formData.customer_id])

  // Handle selected contacts change
  // First, add a state to track whether to include the primary contact
  const [includePrimaryContact, setIncludePrimaryContact] = useState<boolean>(true)

  // Update the handleSelectedContactsChange function to receive the includePrimaryContact flag
  const handleSelectedContactsChange = useCallback((contactIds: string[], includePrimary = true) => {
    setSelectedContactIds(contactIds)
    setIncludePrimaryContact(includePrimary)
  }, [])

  const handleSelectedEmployeesChange = useCallback((employeeIds: string[]) => {
    setSelectedEmployeeIds(employeeIds)
  }, [])

  const verifyOrderItemData = useCallback(
    async (orderId: string) => {
      if (!isValidUUID(orderId)) {
        console.error(`Cannot verify order items: Invalid order ID format: ${orderId}`)
        return false
      }

      try {
        const { data, error } = await supabase
          .from("customer_order_items")
          .select(`
         customer_order_item_id,
         product_id,
         variant_id,
         quantity,
         is_pallet,
         pallets,
         layers,
         products (product_name, unit),
         product_variants (product_variant_name)
       `)
          .eq("customer_order_id", orderId)
          .eq("is_archived", false)

        if (error) {
          console.error("Error verifying order item data:", error)
          return false
        }

        console.log("Saved order items:", data)

        // Compare with current order items
        const currentItems = orderItems.map((item) => ({
          id: item.id,
          product_name: item.product_name,
          variant_name: item.variant_name,
          quantity: item.quantity,
          is_pallet: item.is_pallet,
          pallets: item.pallets,
          layers: item.layers,
          unit: item.unit,
        }))

        console.log("Current order items:", currentItems)

        // Check if pallets and layers were saved correctly
        const palletsLayersSavedCorrectly = data.every((item) => {
          // Check if pallets and layers are not null
          const palletsNotNull = item.pallets !== null
          const layersNotNull = item.layers !== null

          // Log detailed information for debugging
          console.log(`Item ${item.customer_order_item_id}:`, {
            product: item.products?.product_name,
            unit: item.products?.unit,
            pallets: item.pallets,
            layers: item.layers,
            palletsNotNull,
            layersNotNull,
          })

          return palletsNotNull && layersNotNull
        })

        console.log("Pallets and layers saved correctly:", palletsLayersSavedCorrectly)

        return palletsLayersSavedCorrectly
      } catch (error) {
        console.error("Error in verification:", error)
        return false
      }
    },
    [orderItems, supabase],
  )

  const handleToggleEmailNotifications = useCallback((enabled: boolean) => {
    setEnableEmailNotifications(enabled)
    setFormData((prev) => ({ ...prev, send_email: enabled }))
  }, [])

  // Then modify the handleSubmit function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customer_id) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a customer",
      })
      return
    }

    if (orderItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please add at least one item to the order",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Clear the newly inserted items ref at the start of submission
      newlyInsertedItemIdsRef.current.clear()

      const timestamp = getCurrentTimestamp()

      // Use getUser() instead of getSession() for better security
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      // Use the custom time input if it's shown and has a value
      const finalDeliveryTime = showCustomTimeInput && customTimeInput ? customTimeInput : formData.delivery_time

      // Prepare order data
      const orderData = {
        ...formData,
        delivery_time: finalDeliveryTime,
        subtotal_order_value: subtotal,
        total_order_value: total,
        date_last_updated: timestamp,
        updated_by_user_id: userId,
      }

      // Initialize order ID variables
      let currentProcessingOrderId: string // Use a different name to avoid confusion with prop 'orderId'

      if (isEditing && orderId && isValidUUID(orderId)) {
        // Update existing order - use the existing orderId
        currentProcessingOrderId = orderId
        console.log(`Updating existing order with ID: ${currentProcessingOrderId}`)

        const { error } = await supabase.from("customer_orders").update(orderData).eq("id", currentProcessingOrderId)
        if (error) throw error
      } else {
        // Create new order - generate a new UUID
        currentProcessingOrderId = uuidv4()
        console.log(`Creating new order with generated ID: ${currentProcessingOrderId}`)

        const { error } = await supabase.from("customer_orders").insert({
          id: currentProcessingOrderId,
          ...orderData,
          date_created: timestamp,
          created_by_user_id: userId,
          is_archived: false,
        })
        if (error) throw error
      }

      // Validate the order ID before proceeding
      if (!isValidUUID(currentProcessingOrderId)) {
        throw new Error(`Invalid order ID format: ${currentProcessingOrderId}`)
      }

      console.log(`Processing order items for order ID: ${currentProcessingOrderId}`)

      // Process order items
      if (isEditing && orderId && isValidUUID(orderId)) {
        // Check against original prop 'orderId' for "isEditing" context
        // Handle existing items (update or soft delete)
        for (const item of orderItems) {
          // Skip items that have been marked as deleted
          if (deletedItemIdsRef.current.has(item.id)) {
            console.log(`Skipping deleted item: ${item.id}`)
            continue
          }

          // Ensure quantity, pallets, and layers are integers
          const processedItem = {
            ...item,
            quantity: Math.ceil(item.quantity), // Round up quantity
            pallets: Math.floor(item.pallets || 0), // Always include pallets, default to 0
            layers: Math.floor(item.layers || 0), // Always include layers, default to 0
          }

          if (item.id.startsWith("new-")) {
            // This is a new item, insert it
            const newItemId = uuidv4()
            const insertData = {
              customer_order_item_id: newItemId,
              customer_order_id: currentProcessingOrderId, // Use the determined order ID for this submission
              product_id: processedItem.product_id,
              variant_id: processedItem.variant_id,
              unit_price: processedItem.unit_price,
              quantity: processedItem.quantity,
              discount_percentage: processedItem.discount_percentage,
              discount: processedItem.discount,
              total_order_item_value: processedItem.total_order_item_value,
              is_pallet: processedItem.is_pallet,
              pallets: processedItem.pallets, // Always include pallets
              layers: processedItem.layers, // Always include layers
              date_created: timestamp,
              date_last_updated: timestamp,
              created_by_user_id: userId,
              updated_by_user_id: userId,
              is_archived: false,
            }

            console.log("Inserting new order item:", insertData)
            const { error, data } = await supabase.from("customer_order_items").insert(insertData).select()

            if (error) {
              console.error("Error inserting order item:", error)
              throw error
            }

            // Track this newly inserted item ID in the ref to prevent it from being archived
            if (data && data.length > 0) {
              newlyInsertedItemIdsRef.current.add(data[0].customer_order_item_id)
              console.log(`Added newly inserted item ID to ref: ${data[0].customer_order_item_id}`)
            }

            console.log("Inserted order item:", data)
          } else {
            // This is an existing item, update it
            const updateData = {
              product_id: processedItem.product_id,
              variant_id: processedItem.variant_id,
              unit_price: processedItem.unit_price,
              quantity: processedItem.quantity,
              discount_percentage: processedItem.discount_percentage,
              discount: processedItem.discount,
              total_order_item_value: processedItem.total_order_item_value,
              is_pallet: processedItem.is_pallet,
              pallets: processedItem.pallets, // Always include pallets
              layers: processedItem.layers, // Always include layers
              date_last_updated: timestamp,
              updated_by_user_id: userId,
            }

            console.log("Updating order item:", processedItem.id, updateData)
            const { error, data } = await supabase
              .from("customer_order_items")
              .update(updateData)
              .eq("customer_order_item_id", processedItem.id)
              .select()

            if (error) {
              console.error("Error updating order item:", error)
              throw error
            }

            console.log("Updated order item:", data)
          }
        }

        // Get existing items to check for deleted ones
        const { data: existingItems } = await supabase
          .from("customer_order_items")
          .select("customer_order_item_id")
          .eq("customer_order_id", currentProcessingOrderId) // Use the determined order ID
          .eq("is_archived", false)

        if (existingItems) {
          const currentItemIds = orderItems
            .filter((item) => !deletedItemIdsRef.current.has(item.id))
            .filter((item) => !item.id.startsWith("new-"))
            .map((item) => item.id)

          // Log the newly inserted items for debugging
          console.log("Newly inserted items (protected from archiving):", Array.from(newlyInsertedItemIdsRef.current))

          const itemsToDelete = existingItems
            .filter((item) => !currentItemIds.includes(item.customer_order_item_id))
            // Add this line to exclude newly inserted items from being archived
            .filter((item) => !newlyInsertedItemIdsRef.current.has(item.customer_order_item_id))
            .map((item) => item.customer_order_item_id)

          console.log("Items to archive:", itemsToDelete)

          // Soft delete removed items
          for (const itemId of itemsToDelete) {
            await supabase
              .from("customer_order_items")
              .update({
                is_archived: true,
                date_last_updated: timestamp,
                updated_by_user_id: userId,
              })
              .eq("customer_order_item_id", itemId)

            // Add to our deleted items tracking
            deletedItemIdsRef.current.add(itemId)
          }
        }
      } else {
        // Insert all new items (for a new order)
        for (const item of orderItems) {
          // Skip items that have been marked as deleted (less likely for a brand new order, but robust)
          if (deletedItemIdsRef.current.has(item.id)) {
            console.log(`Skipping deleted item: ${item.id}`)
            continue
          }

          // Ensure quantity, pallets, and layers are integers
          const processedItem = {
            ...item,
            quantity: Math.ceil(item.quantity), // Round up quantity
            pallets: Math.floor(item.pallets || 0), // Always include pallets, default to 0
            layers: Math.floor(item.layers || 0), // Always include layers, default to 0
          }

          const newItemId = uuidv4()
          const insertData = {
            customer_order_item_id: newItemId,
            customer_order_id: currentProcessingOrderId, // Use the determined order ID
            product_id: processedItem.product_id,
            variant_id: processedItem.variant_id,
            unit_price: processedItem.unit_price,
            quantity: processedItem.quantity,
            discount_percentage: processedItem.discount_percentage,
            discount: processedItem.discount,
            total_order_item_value: processedItem.total_order_item_value,
            is_pallet: processedItem.is_pallet,
            pallets: processedItem.pallets, // Always include pallets
            layers: processedItem.layers, // Always include layers
            date_created: timestamp,
            date_last_updated: timestamp,
            created_by_user_id: userId,
            updated_by_user_id: userId,
            is_archived: false,
          }

          console.log("Inserting new order item:", insertData)
          const { error, data } = await supabase.from("customer_order_items").insert(insertData).select()

          if (error) {
            console.error("Error inserting order item:", error)
            throw error
          }

          console.log("Inserted order item:", data)
        }
      }

      // Find the section in handleSubmit where inventory is updated (around line 1000-1100)
      // Replace the inventory update logic with this improved implementation:

      // Update inventory - only for items with actual changes
      for (const item of orderItems) {
        // Skip if no variant ID or if item has been deleted
        if (!item.variant_id || deletedItemIdsRef.current.has(item.id)) continue

        // Get current variant data
        const { data: variant } = await supabase
          .from("product_variants")
          .select("quantity, pallets, layers, products(unit, feet_per_layer, layers_per_pallet)")
          .eq("id", item.variant_id)
          .single()

        if (variant) {
          const isSpecialUnit = variant.products?.unit === "Square Feet" || variant.products?.unit === "Linear Feet"
          const feetPerLayer = variant.products?.feet_per_layer || DEFAULT_FEET_PER_LAYER
          const layersPerPallet = variant.products?.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

          // Ensure quantity, pallets, and layers are integers with consistent rounding
          const processedItem = {
            ...item,
            quantity: Math.ceil(item.quantity), // Round up quantity
            pallets: item.pallets !== null ? Math.floor(item.pallets) : 0, // Round down pallets
            layers: item.layers !== null ? Math.floor(item.layers) : 0, // Round down layers
          }

          let changeQuantity = 0
          let changePallets = 0
          let changeLayers = 0

          // If editing, we need to get the original quantity to adjust correctly (Business Logic #2)
          // Check against original prop 'orderId' for "isEditing" context for inventory logic
          if (isEditing && orderId && isValidUUID(orderId)) {
            // Find the original state of this item from originalOrderItems (set at the start of edit)
            const originalItemState = originalOrderItems.find((oi) => oi.id === item.id)

            if (originalItemState) {
              // Calculate the change in quantity based on original state
              changeQuantity = processedItem.quantity - (originalItemState.quantity || 0)
              if (isSpecialUnit && processedItem.is_pallet) {
                changePallets = (processedItem.pallets || 0) - (originalItemState.pallets || 0)
                changeLayers = (processedItem.layers || 0) - (originalItemState.layers || 0)
              }
            } else {
              // This item was added during this edit session (it's in orderItems but not originalOrderItems)
              changeQuantity = processedItem.quantity
              if (isSpecialUnit && processedItem.is_pallet) {
                changePallets = processedItem.pallets || 0
                changeLayers = processedItem.layers || 0
              }
            }
          } else {
            // For new orders, the change is the full quantity (Business Logic #3)
            changeQuantity = processedItem.quantity
            if (isSpecialUnit && processedItem.is_pallet) {
              changePallets = processedItem.pallets || 0
              changeLayers = processedItem.layers || 0
            }
          }

          // Skip update if there's no actual change in quantity
          if (changeQuantity === 0 && (!isSpecialUnit || (changePallets === 0 && changeLayers === 0))) {
            console.log(`Skipping inventory update for variant ${item.variant_id} - no change detected`)
            continue
          }

          // Calculate new inventory values
          const currentQuantity = variant.quantity || 0
          const currentPallets = variant.pallets || 0
          const currentLayers = variant.layers || 0

          // For customer orders, we're removing from inventory, so we negate the change values
          const isUsingPalletsLayers = isSpecialUnit && processedItem.is_pallet

          // Calculate new values directly
          let newQuantity = currentQuantity - changeQuantity
          let newPallets = currentPallets
          let newLayers = currentLayers

          if (isUsingPalletsLayers && isSpecialUnit) {
            // Convert current inventory to total layers
            const currentTotalLayers = currentPallets * layersPerPallet + currentLayers

            // Calculate change in total layers
            const changeTotalLayers = changePallets * layersPerPallet + changeLayers

            // Calculate new total layers
            const newTotalLayers = currentTotalLayers - changeTotalLayers

            // Convert back to pallets and layers
            newPallets = Math.floor(newTotalLayers / layersPerPallet)
            newLayers = newTotalLayers % layersPerPallet

            // Handle negative inventory properly
            if (newPallets < 0 && newLayers > 0) {
              newLayers = newLayers - layersPerPallet
              newPallets += 1 // Still negative, but one closer to zero
            }

            // Recalculate quantity based on total layers
            newQuantity = newTotalLayers * feetPerLayer
          }

          // Log the inventory change
          console.log(`Updating inventory for variant ${item.variant_id}:`, {
            oldQuantity: variant.quantity,
            oldPallets: variant.pallets,
            oldLayers: variant.layers,
            changeQuantity: -changeQuantity, // Negative because we're removing from inventory
            changePallets: isSpecialUnit ? -changePallets : null,
            changeLayers: isSpecialUnit ? -changeLayers : null,
            newQuantity: newQuantity,
            newPallets: newPallets,
            newLayers: newLayers,
          })

          // Update the variant - allow negative values
          await supabase
            .from("product_variants")
            .update({
              quantity: newQuantity, // Allow negative quantity
              pallets: isSpecialUnit ? newPallets : variant.pallets,
              layers: isSpecialUnit ? newLayers : variant.layers,
              date_last_updated: timestamp,
              updated_by_user_id: userId,
            })
            .eq("id", item.variant_id)
        }
      }

      // Process deleted items - add their quantities back to inventory (Business Logic #1)
      for (const item of deletedOrderItems) {
        if (!item.variant_id) continue

        // Skip transient items (added and then deleted in the same session - Business Logic #4)
        if (transientItemIds.has(item.id)) {
          console.log(`Skipping transient item in inventory update: ${item.id}`)
          continue
        }

        // Get current variant data
        const { data: variant } = await supabase
          .from("product_variants")
          .select("quantity, pallets, layers, products(unit, feet_per_layer, layers_per_pallet)")
          .eq("id", item.variant_id)
          .single()

        if (variant) {
          const isSpecialUnit = variant.products?.unit === "Square Feet" || variant.products?.unit === "Linear Feet"
          const feetPerLayer = variant.products?.feet_per_layer || DEFAULT_FEET_PER_LAYER
          const layersPerPallet = variant.products?.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

          // For deleted items, we're adding back to inventory
          const processedItem = {
            ...item,
            quantity: Math.ceil(item.quantity), // Round up quantity
            pallets: item.pallets !== null ? Math.floor(item.pallets) : 0, // Round down pallets
            layers: item.layers !== null ? Math.floor(item.layers) : 0, // Round down layers
          }

          // Skip update if there's no actual change in quantity
          if (
            processedItem.quantity === 0 &&
            (!isSpecialUnit || (processedItem.pallets === 0 && processedItem.layers === 0))
          ) {
            console.log(`Skipping inventory update for deleted variant ${item.variant_id} - no change detected`)
            continue
          }

          // Calculate new inventory values
          const currentQuantity = variant.quantity || 0
          const currentPallets = variant.pallets || 0
          const currentLayers = variant.layers || 0

          // For deleted items, we're adding back to inventory
          let newQuantity = currentQuantity + processedItem.quantity
          let newPallets = currentPallets
          let newLayers = currentLayers

          if (isSpecialUnit && processedItem.is_pallet) {
            // Convert current inventory to total layers
            const currentTotalLayers = currentPallets * layersPerPallet + currentLayers

            // Calculate change in total layers
            const changeTotalLayers = processedItem.pallets * layersPerPallet + processedItem.layers

            // Calculate new total layers
            const newTotalLayers = currentTotalLayers + changeTotalLayers

            // Convert back to pallets and layers
            newPallets = Math.floor(newTotalLayers / layersPerPallet)
            newLayers = newTotalLayers % layersPerPallet

            // Recalculate quantity based on total layers
            newQuantity = newTotalLayers * feetPerLayer
          }

          // Log the inventory change for deleted items
          console.log(`Returning inventory for deleted variant ${item.variant_id}:`, {
            oldQuantity: variant.quantity,
            oldPallets: variant.pallets,
            oldLayers: variant.layers,
            changeQuantity: processedItem.quantity, // Positive because we're adding to inventory
            changePallets: isSpecialUnit ? processedItem.pallets : null,
            changeLayers: isSpecialUnit ? processedItem.layers : null,
            newQuantity: newQuantity,
            newPallets: newPallets,
            newLayers: newLayers,
          })

          // Update the variant
          await supabase
            .from("product_variants")
            .update({
              quantity: newQuantity,
              pallets: isSpecialUnit ? newPallets : variant.pallets,
              layers: isSpecialUnit ? newLayers : variant.layers,
              date_last_updated: timestamp,
              updated_by_user_id: userId,
            })
            .eq("id", item.variant_id)
        }
      }

      // Send email if requested and notifications are enabled
      if (formData.send_email && enableEmailNotifications && customerHasEmail()) {
        setIsSendingEmail(true)
        try {
          // Make sure we're passing the arrays even if they're empty
          const contactIds = selectedContactIds || []
          const employeeIds = selectedEmployeeIds || []

          console.log(`📧 About to send email with: ${contactIds.length} contacts, ${employeeIds.length} employees`)

          // Final validation of currentProcessingOrderId before sending email
          if (!isValidUUID(currentProcessingOrderId)) {
            throw new Error(`Cannot send email: Invalid order ID format: ${currentProcessingOrderId}`)
          }

          console.log(`📧 Using order ID for email: ${currentProcessingOrderId}`)

          const { success, error: emailErrorMsg } = await sendOrderConfirmationEmail(
            currentProcessingOrderId,
            contactIds,
            employeeIds,
            includePrimaryContact,
          )

          if (success) {
            toast({
              title: "Email Sent",
              description: "Order confirmation email has been sent successfully.",
            })
          } else {
            console.error("Error sending order confirmation email:", emailErrorMsg)
            toast({
              variant: "warning",
              title: "Email Not Sent",
              description: emailErrorMsg || "Could not send confirmation email.",
            })
          }
        } catch (emailError: any) {
          toast({
            variant: "warning",
            title: "Email Not Sent",
            description: emailError.message || "Failed to send confirmation email.",
          })
        } finally {
          setIsSendingEmail(false)
        }
      }

      // Show success toast for order creation/update
      toast({
        title: isEditing ? "Order updated" : "Order created",
        description: isEditing
          ? "The order has been updated successfully."
          : "The order has been created successfully.",
      })

      // Verify the data was saved correctly
      const dataVerified = await verifyOrderItemData(currentProcessingOrderId)
      if (dataVerified) {
        console.log("Order item data verified successfully")
      } else {
        console.warn("Order item data verification failed or skipped")
      }

      // Create a promise that resolves after the toast should be visible
      // This ensures the toast has time to display before navigation
      await new Promise((resolve) => setTimeout(resolve, 1500))

      try {
        console.log("Navigating to order list page")
        // Navigate to the orders list first
        await router.push("/dashboard/customer-orders")

        // Wait a moment before navigating to the detail page
        // This ensures the navigation history is properly maintained
        console.log(`Preparing to navigate to order detail page for ID: ${currentProcessingOrderId}`)
        setTimeout(() => {
          console.log(`Navigating to order detail page for ID: ${currentProcessingOrderId}`)
          router.push(`/dashboard/customer-orders/${currentProcessingOrderId}`)
        }, 500)
      } catch (navigationError) {
        console.error("Navigation error:", navigationError)
      }

      if (isEditing) {
        toast({
          title: "Order data updated",
          description: "Basic order information has been updated.",
          duration: 3000,
        })
      } else {
        toast({
          title: "Order created",
          description: "New order has been created successfully.",
          duration: 3000,
        })
      }

      toast({
        title: "Order items processed",
        description: `${orderItems.length} items have been ${isEditing ? "updated" : "added"} to the order.`,
        duration: 3000,
      })

      toast({
        title: "Inventory updated",
        description: "Product inventory levels have been adjusted.",
        duration: 3000,
      })

      toast({
        title: "Order process complete",
        description: "All operations completed successfully. Redirecting to order details...",
        duration: 4000,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while saving the order",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
  }, [])

  const handleSendEmail = async () => {
    if (!orderId) {
      // Check original prop 'orderId'
      toast({
        title: "Error",
        description: "Please save the order before sending emails",
        variant: "destructive",
      })
      return
    }

    // Validate orderId is a string UUID
    if (!isValidUUID(orderId)) {
      // Check original prop 'orderId'
      console.error(`❌ handleSendEmail: Invalid order ID format: ${orderId}`)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Order ID format is invalid. Cannot send email.",
      })
      return
    }

    if (!enableEmailNotifications) {
      toast({
        title: "Email Notifications Disabled",
        description: "Email notifications are currently disabled for this order. Enable them to send emails.",
        variant: "warning",
      })
      return
    }

    // Ensure arrays are properly initialized
    const contactIds = Array.isArray(selectedContactIds) ? [...selectedContactIds] : []
    const employeeIds = Array.isArray(selectedEmployeeIds) ? [...selectedEmployeeIds] : []

    // Check if there are any recipients selected
    const hasRecipients = contactIds.length > 0 || employeeIds.length > 0 || includePrimaryContact

    if (!hasRecipients) {
      toast({
        title: "No Recipients Selected",
        description: "Please select at least one recipient to send the email to.",
        variant: "destructive",
      })
      return
    }

    // Check if customer has a primary email when includePrimaryContact is true
    if (includePrimaryContact) {
      const selectedCustomer = customers.find((c) => c.id === formData.customer_id)
      if (!selectedCustomer?.email) {
        console.warn("⚠️ Primary contact inclusion requested but customer has no email")

        // If no other recipients are selected, show an error
        if (contactIds.length === 0 && employeeIds.length === 0) {
          toast({
            title: "Missing Primary Email",
            description: "The customer does not have a primary email address and no other recipients are selected.",
            variant: "destructive",
          })
          return
        }

        // Otherwise just show a warning
        toast({
          title: "Warning",
          description:
            "The customer does not have a primary email address. The email will be sent to selected contacts and employees only.",
          variant: "warning",
        })
      } else {
        console.log("📧 Primary customer email will be included:", selectedCustomer.email)
      }
    }

    console.log(`📧 Using order ID for manual email: ${orderId}`) // Check original prop 'orderId'

    // Debug the state before sending
    console.log("📧 Email sending state:", {
      orderId, // Check original prop 'orderId'
      contactIds,
      employeeIds,
      includePrimaryContact,
      customerId: formData.customer_id,
    })

    setIsSendingEmail(true)
    try {
      console.log(`📧 Manually sending email with: ${contactIds.length} contacts, ${employeeIds.length} employees`)
      console.log(`📧 Contact IDs: ${JSON.stringify(contactIds)}`)
      console.log(`📧 Employee IDs: ${JSON.stringify(employeeIds)}`)
      console.log(`📧 Include primary contact: ${includePrimaryContact}`)

      const { success, error: emailError } = await sendOrderConfirmationEmail(
        orderId, // Check original prop 'orderId'
        contactIds,
        employeeIds,
        includePrimaryContact,
      )

      if (success) {
        toast({
          title: "Email Sent",
          description: "Order confirmation email has been sent to the selected recipients.",
        })

        // Log the email to customer_email_logs
        try {
          const selectedCustomer = customers.find((c) => c.id === formData.customer_id)
          const emailAddresses: string[] = []

          // Add primary customer email if included
          if (includePrimaryContact && selectedCustomer?.email) {
            emailAddresses.push(selectedCustomer.email)
          }

          // Log each email sent
          for (const emailAddress of emailAddresses) {
            await CustomerCommunicationLogger.logCommunication({
              customer_id: formData.customer_id,
              order_id: orderId, // Check original prop 'orderId'
              email_address: emailAddress,
              subject: `Order Confirmation: ${formData.order_name}`,
              communication_method: "email",
              status: "sent",
            })
          }

          console.log("📝 Email logging completed successfully")
        } catch (loggingError) {
          console.error("Error logging email:", loggingError)
          // Don't throw the error to avoid interfering with the main flow
        }
      } else {
        toast({
          variant: "destructive",
          title: "Email Not Sent",
          description: emailError || "Failed to send email. Please try again.",
        })
      }
    } catch (error: any) {
      console.error("❌ Error sending email:", error)
      toast({
        variant: "destructive",
        title: "Email Not Sent",
        description: error.message || "An error occurred while sending the email.",
      })
    } finally {
      setIsSendingEmail(false)
    }
  }

  // Display initialization error if any
  if (initializationError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        <h3 className="font-bold">Error Initializing Form</h3>
        <p>{initializationError}</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/dashboard/customer-orders")}>
          Return to Orders
        </Button>
      </div>
    )
  }

  // Display loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading order data...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: "details", label: "Order Details", icon: <ClipboardList className="h-4 w-4" /> },
    { id: "items", label: "Order Items", icon: <ShoppingCart className="h-4 w-4" /> },
    { id: "inventory", label: "Inventory Impact", icon: <AlertTriangle className="h-4 w-4" /> },
    { id: "emails", label: "Email Recipients", icon: <Users className="h-4 w-4" /> },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Tabs defaultValue="details" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 p-1 bg-muted rounded-lg">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md transition-all",
                "data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:font-medium",
                "hover:bg-gray-100/80 hover:data-[state=active]:bg-black",
              )}
              aria-label={`${tab.label} Tab`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Order Information</CardTitle>
                <CardDescription>Enter the basic order information</CardDescription>
              </div>
              <div className="font-mono text-blue-600 font-bold text-right">{formData.order_name}</div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer field on its own row */}
              <div className="w-full">
                <Label htmlFor="customer_id">Customer *</Label>
                <SearchableSelect
                  id="customer_id"
                  value={
                    formData.customer_id
                      ? {
                          value: formData.customer_id,
                          label:
                            customers.find((c) => c.id === formData.customer_id)?.customer_name || "Unknown Customer",
                        }
                      : null
                  }
                  onChange={(option) => handleSelectChange("customer_id", option?.value || "")}
                  options={customers.map((customer) => ({
                    value: customer.id,
                    label: customer.customer_name,
                  }))}
                  placeholder="Select customer"
                  formatOptionLabel={(option) => (
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium truncate">{option.label}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded ml-2">
                          ID: {option.value.substring(0, 8)}...
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {customers.find((c) => c.id === option.value)?.email || "No email"}
                      </span>
                    </div>
                  )}
                />
              </div>

              {/* Order Status, Payment Status, Amount Paid, and Tax Rate in a single row */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="status">Order Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Processing">Processing</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-4 space-y-2">
                  <Label htmlFor="payment_status">Payment Status *</Label>
                  <Select
                    value={formData.payment_status}
                    onValueChange={(value) => handleSelectChange("payment_status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment status">
                        {formData.payment_status && (
                          <>
                            {formData.payment_status !== "Unpaid" && formData.payment_status !== "Paid" ? (
                              <div className="flex items-center text-amber-600">
                                <span>{formData.payment_status}</span>
                                <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded ml-2">
                                  Non-standard value
                                </span>
                              </div>
                            ) : (
                              formData.payment_status
                            )}
                          </>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unpaid">Unpaid</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      {/* Keep the original value as an option if it's non-standard */}
                      {formData.payment_status &&
                        formData.payment_status !== "Unpaid" &&
                        formData.payment_status !== "Paid" && (
                          <SelectItem value={formData.payment_status} className="text-amber-600">
                            {formData.payment_status} (Original)
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="amount_paid">Amount Paid</Label>
                  <Input
                    id="amount_paid"
                    name="amount_paid"
                    type="number"
                    step="0.01"
                    value={formData.amount_paid}
                    onChange={handleNumberChange}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="discount_percentage">Discount (%)</Label>
                  <Input
                    id="discount_percentage"
                    name="discount_percentage"
                    type="number"
                    step="0.01"
                    value={formData.discount_percentage}
                    onChange={handleNumberChange}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input
                    id="tax_rate"
                    name="tax_rate"
                    type="number"
                    step="0.01"
                    value={formData.tax_rate}
                    onChange={handleNumberChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery Information</CardTitle>
              <CardDescription>Enter the delivery details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Single line layout for Method, Date, and Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delivery_method">Delivery Method *</Label>
                  <Select
                    value={formData.delivery_method}
                    onValueChange={(value) => handleSelectChange("delivery_method", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery method">
                        {formData.delivery_method && (
                          <>
                            {formData.delivery_method !== "Delivery" && formData.delivery_method !== "Pickup" ? (
                              <div className="flex items-center text-amber-600">
                                <span>{formData.delivery_method}</span>
                                <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded ml-2">
                                  Non-standard value
                                </span>
                              </div>
                            ) : (
                              formData.delivery_method
                            )}
                          </>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Delivery">Delivery</SelectItem>
                      <SelectItem value="Pickup">Pickup</SelectItem>
                      {/* Keep the original value as an option if it's non-standard */}
                      {formData.delivery_method &&
                        formData.delivery_method !== "Delivery" &&
                        formData.delivery_method !== "Pickup" && (
                          <SelectItem value={formData.delivery_method} className="text-amber-600">
                            {formData.delivery_method} (Original)
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Delivery Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deliveryDate ? format(deliveryDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={deliveryDate} onSelect={handleDateChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_time">Delivery Time *</Label>
                  {showCustomTimeInput ? (
                    <div className="flex gap-2">
                      <Input
                        id="custom_delivery_time"
                        value={customTimeInput}
                        onChange={handleCustomTimeChange}
                        placeholder="Enter time (e.g., 3:00 PM)"
                        className="flex-1"
                      />
                      <Button type="button" variant="outline" onClick={() => setShowCustomTimeInput(false)}>
                        Use Standard
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={formData.delivery_time}
                      onValueChange={(value) => handleSelectChange("delivery_time", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select time">
                          {formData.delivery_time && (
                            <>
                              {formData.delivery_time !== "custom" &&
                              !/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(formData.delivery_time) ? (
                                <div className="flex items-center text-amber-600">
                                  <span>{formData.delivery_time}</span>
                                  <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded ml-2">
                                    Non-standard value
                                  </span>
                                </div>
                              ) : (
                                formData.delivery_time
                              )}
                            </>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="09:00">09:00 AM</SelectItem>
                        <SelectItem value="10:00">10:00 AM</SelectItem>
                        <SelectItem value="11:00">11:00 AM</SelectItem>
                        <SelectItem value="12:00">12:00 PM</SelectItem>
                        <SelectItem value="13:00">01:00 PM</SelectItem>
                        <SelectItem value="14:00">02:00 PM</SelectItem>
                        <SelectItem value="15:00">03:00 PM</SelectItem>
                        <SelectItem value="16:00">04:00 PM</SelectItem>
                        <SelectItem value="17:00">05:00 PM</SelectItem>
                        <SelectItem value="custom">Custom Time</SelectItem>
                        {/* Keep the original value as an option if it's non-standard */}
                        {formData.delivery_time &&
                          formData.delivery_time !== "custom" &&
                          !/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(formData.delivery_time) && (
                            <SelectItem value={formData.delivery_time} className="text-amber-600">
                              {formData.delivery_time} (Original)
                            </SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_address">Delivery Address</Label>
                <Input
                  id="delivery_address"
                  name="delivery_address"
                  value={formData.delivery_address}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_instructions">Delivery Instructions</Label>
                <Textarea
                  id="delivery_instructions"
                  name="delivery_instructions"
                  value={formData.delivery_instructions}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>Review the order totals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Subtotal:</Label>
                  <div className="font-medium">{formatCurrency(subtotal)}</div>
                </div>
                {formData.discount_percentage > 0 && (
                  <div>
                    <Label>Discount ({formData.discount_percentage}%):</Label>
                    <div className="font-medium text-red-600">-{formatCurrency(discountAmount)}</div>
                  </div>
                )}
                <div>
                  <Label>Tax ({formData.tax_rate}%):</Label>
                  <div className="font-medium">{formatCurrency(taxAmount)}</div>
                </div>
                <div>
                  <Label>Total:</Label>
                  <div className="text-xl font-bold">{formatCurrency(total)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Reference to Email Recipients tab */}
        </TabsContent>

        <TabsContent value="items">
          <CustomerOrderItems
            products={products}
            orderItems={orderItems}
            setOrderItems={setOrderItems}
            onItemRemoved={handleItemRemoved}
          />
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Impact</CardTitle>
              <CardDescription>Review the changes to inventory levels</CardDescription>
            </CardHeader>
            <CardContent>
              {inventoryChanges.length > 0 ? (
                <InventoryImpactTable inventoryChanges={inventoryChanges} />
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  No inventory changes to display. Add items to the order to see their impact on inventory.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails">
          <EmailRecipientsTab
            customerId={formData.customer_id}
            orderId={orderId || ""}
            selectedContactIds={selectedContactIds}
            onContactsChange={handleSelectedContactsChange}
            selectedEmployeeIds={selectedEmployeeIds}
            onEmployeesChange={handleSelectedEmployeesChange}
            onSendEmail={handleSendEmail}
            isSending={isSendingEmail}
            customerEmail={customers.find((c) => c.id === formData.customer_id)?.email || null}
            customerName={customers.find((c) => c.id === formData.customer_id)?.customer_name || null}
            enableEmailNotifications={enableEmailNotifications}
            onToggleEmailNotifications={handleToggleEmailNotifications}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (isEditing ? "Updating..." : "Creating...") : isEditing ? "Update Order" : "Create Order"}
        </Button>
      </div>
    </form>
  )
}
