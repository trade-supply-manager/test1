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
import { formatCurrency, getCurrentTimestamp, calculateInventoryImpact } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ClipboardList, ShoppingCart, AlertTriangle, Users, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase-client"
import { PurchaseOrderItems } from "@/components/purchase-orders/purchase-order-items"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { log, LogLevel } from "@/lib/debug-utils"
import { withRateLimitRetry } from "@/lib/rate-limit-utils"
import { EmailRecipientsTab } from "@/components/purchase-orders/email-recipients-tab"
import { InventoryImpactTable } from "@/components/purchase-orders/inventory-impact-table"

// Add this debugging function at the top of the file, after the imports
const debugVariantFlow = (location: string, variants: any[], filter?: string) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `%c[VARIANT FLOW DEBUG] ${location} ${filter ? `(${filter})` : ""}`,
      "background: #673ab7; color: white; padding: 2px 5px; border-radius: 3px;",
    )

    // Count variants with negative quantities
    const negativeQuantityVariants = variants.filter(
      (v) => v.quantity !== null && v.quantity !== undefined && v.quantity < 0,
    )

    console.log(`Total variants: ${variants.length}, Negative quantity variants: ${variants.length}`)

    if (negativeQuantityVariants.length > 0) {
      console.log("Sample negative quantity variants:")
      console.table(
        negativeQuantityVariants.slice(0, 5).map((v) => ({
          id: v.id?.substring(0, 8) || "N/A",
          name: v.product_variant_name || "N/A",
          quantity: v.quantity,
          product_id: v.product_id?.substring(0, 8) || "N/A",
        })),
      )
    }
  }
}

interface ProductVariant {
  id: string
  product_variant_name: string
  product_variant_sku: string
  unit_price: number | null
}

interface Manufacturer {
  id: string
  manufacturer_name: string
  email?: string | null
}

interface Product {
  id: string
  product_name: string
  product_category: string
  manufacturer_id: string
  product_variants: ProductVariant[]
  unit?: string | null
  feet_per_layer?: number | null
  layers_per_pallet?: number | null
}

interface OrderItem {
  purchase_order_item_id: string
  product_id: string
  variant_id: string
  product_name: string
  variant_name: string
  variant_sku: string
  unit_price: number
  quantity: number
  discount_percentage: number
  discount: number
  total: number
  total_order_item_value?: number
  is_pallet?: boolean
  pallets?: number | null
  layers?: number | null
  unit?: string | null
  feet_per_layer?: number | null
  layers_per_pallet?: number | null
  isTransient?: boolean
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
  is_deleted?: boolean
  isTransient?: boolean
}

interface PurchaseOrderFormProps {
  manufacturers: Manufacturer[]
  products: Product[]
  orderId?: string
  initialData?: any
  mode?: "create" | "edit" // Add a mode prop to differentiate between create and edit
}

// Default conversion rates
const DEFAULT_FEET_PER_LAYER = 100 // Default square feet per layer
const DEFAULT_LAYERS_PER_PALLET = 10 // Default layers per pallet

// Function to generate a styled order name in the format PO-YYYYMMDD-XXXXXX-YYYYYY
function generateStyledOrderName(): string {
  // Format: PO-YYYYMMDD-XXXXXX-YYYYYY
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "") // YYYYMMDD
  const firstRandomSuffix = Math.floor(100000 + Math.random() * 900000).toString() // 6-digit random number
  const secondRandomSuffix = Math.floor(100000 + Math.random() * 900000).toString() // 6-digit random number

  return `PO-${datePart}-${firstRandomSuffix}-${secondRandomSuffix}`
}

// Function to validate order name format
function validateOrderName(orderName: string): boolean {
  // Regex pattern for PO-YYYYMMDD-XXXXXX-YYYYYY
  const orderNamePattern = /^PO-\d{8}-\d{6}-\d{6}$/
  return orderNamePattern.test(orderName)
}

// Add the named export to fix the deployment error
export function PurchaseOrderForm(props: PurchaseOrderFormProps) {
  return <PurchaseOrderFormComponent {...props} />
}

// Keep the default export for backward compatibility
export function PurchaseOrderFormComponent({
  manufacturers = [],
  products: initialProducts = [],
  orderId,
  initialData,
  mode = "edit", // Default to "edit" mode
}: PurchaseOrderFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  const isEditing = mode === "edit" && !!orderId // Determine if it's in edit mode

  // Initialize form with default values for a new order
  const [formData, setFormData] = useState({
    order_name: initialData?.order_name || generateStyledOrderName(),
    manufacturer_id: initialData?.manufacturer_id || "",
    status: initialData?.status || "Pending",
    payment_status: initialData?.payment_status || "Unpaid",
    delivery_method: initialData?.delivery_method || "Delivery",
    delivery_date: initialData?.delivery_date || new Date().toISOString(),
    delivery_time: initialData?.delivery_time || "09:00",
    delivery_address: initialData?.delivery_address || "",
    delivery_instructions: initialData?.delivery_instructions || "",
    notes: initialData?.notes || "",
    amount_paid: initialData?.amount_paid !== undefined ? Number(initialData.amount_paid) : 0,
    send_email: initialData?.send_email === true,
  })

  // Debug state to track form initialization
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [initializationError, setInitializationError] = useState<string | null>(null)

  // Add this after other state declarations
  const [isInitialLoading, setIsInitialLoading] = useState(true)

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

  // Initialize the ref in a useEffect to ensure it's only done once on the client side
  useEffect(() => {
    deletedItemIdsRef.current = new Set()
  }, [])

  // Flag to prevent re-fetching items after deletion
  const [hasManuallyModifiedItems, setHasManuallyModifiedItems] = useState(false)

  // State for inventory changes
  const [inventoryChanges, setInventoryChanges] = useState<InventoryChange[]>([])
  const [isCalculatingInventory, setIsCalculatingInventory] = useState(false)

  // State for showing the add item form
  const [showAddItemForm, setShowAddItemForm] = useState(false)

  // Email recipients state
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [includePrimaryContact, setIncludePrimaryContact] = useState(true)
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [customEmailMessage, setCustomEmailMessage] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailLogs, setEmailLogs] = useState<any[]>([])

  // Form state
  // const [formData, setFormData] = useState({
  //   order_name: generateStyledOrderName(),
  //   manufacturer_id: "",
  //   status: "Pending",
  //   payment_status: "Unpaid",
  //   delivery_method: "Delivery",
  //   delivery_date: new Date().toISOString(),
  //   delivery_time: "09:00",
  //   delivery_address: "",
  //   delivery_instructions: "",
  //   notes: "",
  //   amount_paid: 0,
  //   send_email: true,
  // })

  // State for delivery date picker
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date())

  // Order items state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("details")

  // New state variables for product selection
  const [products, setProducts] = useState<Product[]>([])
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState<string>("")
  const [unitPrice, setUnitPrice] = useState<string>("")

  // New state variable for employees
  const [employees, setEmployees] = useState<any[]>([])

  // Add this after other state declarations
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && employees.length > 0) {
      console.log(`PurchaseOrderForm: ${employees.length} active employees loaded`)
    }
  }, [employees])

  // Log products data on component mount to verify product data structure
  const isFirstRenderRef = useRef(true)
  useEffect(() => {
    // Only log in development environment and when products actually change
    if (process.env.NODE_ENV === "development") {
      // Use a ref to track if this is the first mount

      if (isFirstRenderRef.current || products.length > 0) {
        log(LogLevel.DEBUG, "PurchaseOrderForm", "Products data updated:", { count: products.length })

        // More detailed logging only on first render or significant changes
        if (isFirstRenderRef.current) {
          const productsWithUnits = products.filter((p) => p.unit)
          log(
            LogLevel.DEBUG,
            "PurchaseOrderForm",
            `Found ${productsWithUnits.length} products with unit values out of ${products.length} total products`,
          )
          isFirstRenderRef.current = false
        }
      }
    }
  }, [products])

  // Enhanced data fetching with better error handling and logging
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        if (process.env.NODE_ENV === "development") {
          log(LogLevel.DEBUG, "PurchaseOrderForm", "Fetching products data...")
        }

        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("*")
          .order("product_name")

        if (productsError) {
          log(LogLevel.ERROR, "PurchaseOrderForm", "Failed to fetch products", productsError)
          toast({
            title: "Error",
            description: "Failed to fetch products. Please try again.",
            variant: "destructive",
          })
          return
        }

        if (process.env.NODE_ENV === "development") {
          log(
            LogLevel.DEBUG,
            "PurchaseOrderForm",
            `Products data fetched successfully: ${productsData?.length || 0} products`,
          )

          // Count products missing unit property instead of logging each one
          const missingUnitCount = productsData.filter((p) => !p.unit).length
          if (missingUnitCount > 0) {
            log(LogLevel.WARN, "PurchaseOrderForm", `${missingUnitCount} products are missing the unit property`)
          }
        }

        setProducts(productsData)
      } catch (error) {
        log(LogLevel.ERROR, "PurchaseOrderForm", "Exception during products fetch:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred while fetching products.",
          variant: "destructive",
        })
      }
    }

    fetchProducts()
  }, [supabase, toast])

  // Enhanced product variants fetching with better error handling and logging
  useEffect(() => {
    const fetchProductVariants = async () => {
      try {
        if (process.env.NODE_ENV === "development") {
          log(LogLevel.DEBUG, "PurchaseOrderForm", "Fetching product variants...")
        }

        // Initialize an array to hold all variants
        let allVariants: any[] = []
        let hasMore = true
        let page = 0
        const pageSize = 1000 // Supabase's default limit

        // Fetch variants in batches until we have all of them
        while (hasMore) {
          const { data: variantsData, error: variantsError } = await supabase
            .from("product_variants")
            .select("*")
            .order("product_variant_name")
            .range(page * pageSize, (page + 1) * pageSize - 1)

          if (variantsError) {
            log(LogLevel.ERROR, "PurchaseOrderForm", "Error fetching product variants:", variantsError)
            toast({
              title: "Error",
              description: "Failed to fetch product variants. Please try again.",
              variant: "destructive",
            })
            return
          }

          if (variantsData && variantsData.length > 0) {
            allVariants = [...allVariants, ...variantsData]

            // If we got fewer results than the page size, we've reached the end
            if (variantsData.length < pageSize) {
              hasMore = false
            }
          } else {
            hasMore = false
          }

          page++
        }

        // Debug the raw variants data from the database
        debugVariantFlow("Raw variants from database (all pages)", allVariants)

        if (process.env.NODE_ENV === "development") {
          log(
            LogLevel.DEBUG,
            "PurchaseOrderForm",
            `Product variants fetched across ${page} pages: ${allVariants.length} total variants`,
          )

          // Only log data issues, not the entire dataset
          if (!allVariants || allVariants.length === 0) {
            log(LogLevel.WARN, "PurchaseOrderForm", "No product variants returned from the database")
          } else {
            const dataIssues = []

            const variantsWithoutProductId = allVariants.filter((v) => !v.product_id).length
            if (variantsWithoutProductId > 0) {
              dataIssues.push(`${variantsWithoutProductId} variants without product_id`)
            }

            const variantsWithoutId = allVariants.filter((v) => !v.id).length
            if (variantsWithoutId > 0) {
              dataIssues.push(`${variantsWithoutId} variants without id`)
            }

            // Check for variants with negative quantities
            const variantsWithNegativeQuantity = allVariants.filter((v) => v.quantity !== null && v.quantity < 0).length
            if (variantsWithNegativeQuantity > 0) {
              dataIssues.push(`${variantsWithNegativeQuantity} variants with negative quantity`)

              // Log some examples of variants with negative quantities
              const examples = allVariants
                .filter((v) => v.quantity !== null && v.quantity < 0)
                .slice(0, 3)
                .map((v) => `${v.product_variant_name} (${v.id.substring(0, 8)}): ${v.quantity}`)

              log(
                LogLevel.INFO,
                "PurchaseOrderForm",
                `Examples of variants with negative quantities: ${examples.join(", ")}`,
              )
            }

            if (dataIssues.length > 0) {
              log(LogLevel.WARN, "PurchaseOrderForm", `Product variant data issues: ${dataIssues.join(", ")}`)
            }
          }
        }

        setProductVariants(allVariants)

        // Debug the variants after setting state
        debugVariantFlow("After setting productVariants state (all pages)", allVariants)
      } catch (error) {
        log(LogLevel.ERROR, "PurchaseOrderForm", "Exception during product variants fetch:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred while fetching product variants.",
          variant: "destructive",
        })
      }
    }

    fetchProductVariants()
  }, [supabase, toast])

  // Add this new useEffect after the product variants fetching useEffect
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data: employees, error } = await supabase
          .from("employees")
          .select("id, employee_name, email, role, department")
          .eq("is_active", true)
          .order("employee_name", { ascending: true })

        if (error) {
          console.error("Error fetching employees:", error)
          return
        }

        if (employees && employees.length > 0) {
          setEmployees(employees)
          // Auto-select all employees by default for new orders
          if (!orderId && selectedEmployeeIds.length === 0) {
            const allEmployeeIds = employees.map((employee) => employee.id)
            setSelectedEmployeeIds(allEmployeeIds)
          }
        } else {
          setEmployees([])
        }
      } catch (error) {
        console.error("Error fetching employees:", error)
      }
    }

    // Fetch employees when the form is initialized
    if (isInitialized) {
      fetchEmployees()
    }
  }, [isInitialized, orderId, supabase, selectedEmployeeIds.length])

  // Get selected manufacturer details
  const selectedManufacturer = manufacturers.find((m) => m.id === formData.manufacturer_id)

  // Filter products by selected manufacturer
  const filteredProducts = formData.manufacturer_id
    ? products.filter((product) => product.manufacturer_id === formData.manufacturer_id)
    : products

  // Convert manufacturers to options for SearchableSelect
  const manufacturerOptions = manufacturers.map((manufacturer) => ({
    value: manufacturer.id,
    label: manufacturer.manufacturer_name,
  }))

  // Debug function to log form state
  const logFormState = useCallback(
    (message: string, data?: any) => {
      if (process.env.NODE_ENV === "development") {
        log(LogLevel.DEBUG, "PurchaseOrderForm", `[${isEditing ? "EDIT" : "NEW"}] ${message}`, data ? data : "")
      }
    },
    [isEditing],
  )

  useEffect(() => {
    if (initialData && !isInitialized) {
      try {
        setIsLoading(true)
        logFormState("Initializing form with data:", initialData)

        // Set form data with all fields from initialData
        setFormData({
          order_name: initialData.order_name || generateStyledOrderName(),
          manufacturer_id: initialData.manufacturer_id || "",
          status: initialData.status || "Pending",
          payment_status: initialData.payment_status || "Unpaid",
          delivery_method: initialData.delivery_method || "Delivery",
          delivery_date: initialData.delivery_date || new Date().toISOString(),
          delivery_time: initialData.delivery_time || "09:00",
          delivery_address: initialData.delivery_address || "",
          delivery_instructions: initialData.delivery_instructions || "",
          notes: initialData.notes || "",
          amount_paid: initialData.amount_paid !== undefined ? Number(initialData.amount_paid) : 0,
          send_email: initialData.send_email === true,
        })

        // If editing an existing order, set email notification state based on the order
        if (initialData.send_email !== undefined) {
          setEnableEmailNotifications(initialData.send_email)
        }

        // Set default email subject if editing an existing order
        if (initialData.order_name) {
          setEmailSubject(`Purchase Order: ${initialData.order_name}`)
        }

        // Handle delivery date properly
        if (initialData.delivery_date) {
          try {
            // Parse the date string to a Date object
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

        // Check if the delivery time is in the standard format for the dropdown
        const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/
        const isStandardTimeFormat = timeRegex.test(initialData.delivery_time || "")

        // If not in standard format, we'll need to use custom input
        if (!isStandardTimeFormat && initialData.delivery_time) {
          setShowCustomTimeInput(true)
          setCustomTimeInput(initialData.delivery_time)
        }

        setIsInitialized(true)
        logFormState("Form initialization complete")
      } catch (error: any) {
        console.error("Error initializing form data:", error)
        setInitializationError(error.message || "Error initializing form")
        // Still mark as initialized to prevent infinite loops
        setIsInitialized(true)
      } finally {
        setIsLoading(false)
      }
    } else if (!initialData && !isInitialized) {
      // If there's no initial data (new order), just mark as initialized
      setIsInitialized(true)
      setIsLoading(false)
    }
  }, [initialData, isInitialized, logFormState])

  // Load order items if editing an existing order
  useEffect(() => {
    async function fetchOrderItems() {
      if (!orderId || hasManuallyModifiedItems || !formData.manufacturer_id) return

      try {
        if (process.env.NODE_ENV === "development") {
          logFormState("Fetching order items for order ID:", orderId)
        }

        // Set initial loading flag to true before fetching
        setIsInitialLoading(true)

        // Wrap the Supabase query with our retry utility
        const { data, error } = await withRateLimitRetry(() =>
          supabase
            .from("purchase_order_items")
            .select(`
              purchase_order_item_id,
              product_id,
              variant_id,
              quantity,
              unit_price,
              discount_percentage,
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
                product_variant_name,
                product_variant_sku
              )
            `)
            .eq("purchase_order_id", orderId)
            .eq("is_archived", false),
        )

        if (error) {
          console.error("Error fetching order items:", error)
          throw error
        }

        if (data && data.length > 0) {
          if (process.env.NODE_ENV === "development") {
            logFormState(`Found ${data.length} order items`)

            // Only log summary information, not the entire data object
            const itemsWithUnits = data.filter((item) => item.products?.unit).length
            const itemsWithoutUnits = data.length - itemsWithUnits

            if (itemsWithoutUnits > 0) {
              log(LogLevel.WARN, "PurchaseOrderForm", `${itemsWithoutUnits} items are missing unit values`)
            }
          }

          const formattedItems = data
            .map((item) => {
              return {
                purchase_order_item_id: item.purchase_order_item_id,
                product_id: item.product_id,
                variant_id: item.variant_id,
                product_name: item.products?.product_name || "Unknown Product",
                variant_name: item.product_variants?.product_variant_name || "Unknown Variant",
                variant_sku: item.product_variants?.product_variant_sku || "",
                unit_price: item.unit_price || 0,
                quantity: item.quantity || 0,
                discount_percentage: item.discount_percentage || 0,
                total: item.total_order_item_value || 0,
                discount: ((item.unit_price || 0) * (item.quantity || 0) * (item.discount_percentage || 0)) / 100,
                total_order_item_value: item.total_order_item_value || 0,
                is_pallet: item.is_pallet || false,
                pallets: item.pallets,
                layers: item.layers,
                unit: item.products?.unit || "Each", // Always use product's unit as source of truth
                feet_per_layer: item.products?.feet_per_layer,
                layers_per_pallet: item.products?.layers_per_pallet,
              }
            })
            // Filter out any items that have been manually deleted
            .filter((item) => !deletedItemIdsRef.current.has(item.purchase_order_item_id))

          setOrderItems(formattedItems)

          // Store the original items for comparison later
          if (originalOrderItems.length === 0) {
            setOriginalOrderItems([...formattedItems])
          }
        } else {
          logFormState("No order items found or items array is empty")
        }
      } catch (error: any) {
        console.error("Error in fetchOrderItems:", error)
        toast({
          variant: "destructive",
          title: "Error fetching order items",
          description: error.message,
        })
      } finally {
        // Set initial loading flag to false after fetching is complete
        setTimeout(() => {
          setIsInitialLoading(false)
        }, 500) // Add a small delay to ensure state updates are processed
      }
    }

    // Fetch email recipients if editing an existing order
    async function fetchEmailRecipients() {
      if (!orderId) return

      try {
        // Fetch selected contacts
        const { data: contactsData, error } = await supabase
          .from("purchase_order_email_recipients")
          .select("contact_id, include_primary_contact")
          .eq("purchase_order_id", orderId)
          .eq("recipient_type", "contact")

        if (error) {
          console.error("Error fetching contacts data:", error)
          return
        }

        if (contactsData && contactsData.length > 0) {
          const contactIds = contactsData.map((c) => c.contact_id).filter((id) => id !== null) as string[]
          setSelectedContactIds(contactIds)

          // Check if primary contact is included
          const primaryContactRecord = contactsData.find((c) => c.include_primary_contact !== null)
          if (primaryContactRecord) {
            setIncludePrimaryContact(primaryContactRecord.include_primary_contact)
          }
        }

        // Fetch selected employees
        const { data: employeesData, error: employeesError } = await supabase
          .from("purchase_order_email_recipients")
          .select("employee_id")
          .eq("purchase_order_id", orderId)
          .eq("recipient_type", "employee")

        if (employeesError) {
          console.error("Error fetching employees data:", employeesError)
          return
        }

        if (employeesData && employeesData.length > 0) {
          const employeeIds = employeesData.map((e) => e.employee_id).filter((id) => id !== null) as string[]
          setSelectedEmployeeIds(employeeIds)
        }

        // Fetch email logs
        if (orderId) {
          const { data: logs, error: logsError } = await supabase
            .from("manufacturer_email_logs")
            .select(`
              id,
              date_created,
              communication_method,
              subject,
              email_address,
              status,
              error_message
            `)
            .eq("order_id", orderId)
            .order("date_created", { ascending: false })

          if (logsError) {
            console.error("Error fetching email logs:", logsError)
            return
          }

          if (logs) {
            setEmailLogs(logs)
          }
        }
      } catch (error) {
        console.error("Error fetching email recipients:", error)
      }
    }

    if (isEditing && isInitialized && orderId) {
      fetchOrderItems()
      fetchEmailRecipients()
    }
  }, [
    isEditing,
    isInitialized,
    orderId,
    supabase,
    toast,
    hasManuallyModifiedItems,
    originalOrderItems.length,
    deletedItemIdsRef,
    logFormState,
    formData.manufacturer_id,
  ])

  // Update email subject when order name changes
  useEffect(() => {
    if (formData.order_name && !emailSubject) {
      setEmailSubject(`Purchase Order: ${formData.order_name}`)
    }
  }, [formData.order_name, emailSubject])

  // Validate order items when manufacturer changes
  useEffect(() => {
    // Skip validation during these conditions:
    // 1. During initial loading phase
    // 2. When there's no manufacturer selected
    // 3. When there are no order items to validate
    if (isInitialLoading || !formData.manufacturer_id || orderItems.length === 0) {
      return
    }

    // Get the list of product IDs for the selected manufacturer
    const manufacturerProductIds = products
      .filter((product) => product.manufacturer_id === formData.manufacturer_id)
      .map((product) => product.id)

    // Check if any order items have products that don't belong to the selected manufacturer
    const invalidItems = orderItems.filter((item) => !manufacturerProductIds.includes(item.product_id))

    // Only show the toast and remove items if:
    // 1. There are actually invalid items
    // 2. This is not the initial load (hasManuallyModifiedItems is true or we've already loaded the original items)
    // 3. We're not in the middle of a programmatic update
    if (invalidItems.length > 0) {
      // Log for debugging
      if (process.env.NODE_ENV === "development") {
        log(
          LogLevel.WARN,
          "PurchaseOrderForm",
          `Found ${invalidItems.length} items that don't belong to manufacturer ${formData.manufacturer_id}. Removing them.`,
        )
      }

      // Remove invalid items
      setOrderItems((prevItems) => prevItems.filter((item) => manufacturerProductIds.includes(item.product_id)))

      // Only show toast if this is a user-initiated change
      if (hasManuallyModifiedItems) {
        toast({
          title: "Items Removed",
          description: `${invalidItems.length} ${invalidItems.length === 1 ? "item was" : "items were"} removed because ${
            invalidItems.length === 1 ? "it doesn't" : "they don't"
          } belong to the selected manufacturer.`,
          variant: "warning",
        })
      }
    }
  }, [formData.manufacturer_id, products, orderItems, toast, hasManuallyModifiedItems, isInitialLoading])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target

    // Special validation for order_name field
    if (name === "order_name" && value !== "" && !validateOrderName(value)) {
      toast({
        variant: "warning",
        title: "Invalid Order Name Format",
        description: "Order name must follow the format: PO-YYYYMMDD-XXXXXX-YYYYYY",
      })
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: Number(value) }))
  }

  const handleSelectChange = (name: string, value: string) => {
    // Special handling for delivery_time
    if (name === "delivery_time" && value === "custom") {
      setShowCustomTimeInput(true)
      return
    }

    // Special handling for manufacturer_id changes
    if (name === "manufacturer_id") {
      // If manufacturer changes, we need to clear order items to prevent errors
      // with products that don't belong to the new manufacturer
      if (value !== formData.manufacturer_id) {
        // Mark as manually modified to ensure validation runs properly
        setHasManuallyModifiedItems(true)

        // Log the change for debugging
        log(LogLevel.DEBUG, "PurchaseOrderForm", `Manufacturer changed from ${formData.manufacturer_id} to ${value}`)

        // Reset email recipients when manufacturer changes
        setSelectedContactIds([])
      }
    }

    // Update the form data with the new value
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomTimeInput(value)
    setFormData((prev) => ({ ...prev, delivery_time: value }))
  }

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setDeliveryDate(date)
      setFormData((prev) => ({ ...prev, delivery_date: date.toISOString() }))
    }
  }

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleContactsChange = (contactIds: string[], includePrimary: boolean) => {
    setSelectedContactIds(contactIds)
    setIncludePrimaryContact(includePrimary)
  }

  const handleEmployeesChange = (employeeIds: string[]) => {
    setSelectedEmployeeIds(employeeIds)
  }

  const handleToggleEmailNotifications = (enabled: boolean) => {
    setEnableEmailNotifications(enabled)
    setFormData((prev) => ({ ...prev, send_email: enabled }))
  }

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
  }, [])

  // Enhanced handleProductChange with better logging and unit handling
  const handleProductChange = (productId: string) => {
    // Find the selected product
    const product = products.find((p) => p.id === productId)

    if (!product) {
      log(LogLevel.ERROR, "PurchaseOrderForm", `Product with ID ${productId} not found in products array`)
      toast({
        title: "Error",
        description: "Selected product not found. Please try again.",
        variant: "destructive",
      })
      return
    }

    // Filter variants for this product
    const filteredVariants = productVariants.filter((variant) => variant.product_id === productId)

    if (process.env.NODE_ENV === "development") {
      log(
        LogLevel.DEBUG,
        "PurchaseOrderForm",
        `Product changed to: ${product.product_name} (${filteredVariants.length} variants)`,
      )
    }

    // Update state with product data, ensuring unit is included
    setSelectedProduct({
      id: product.id,
      name: product.product_name,
      unit: product.unit, // Explicitly set the unit from the product
      variants: filteredVariants,
    })

    // Reset other fields
    setSelectedVariant(null)
    setQuantity("")
    setUnitPrice("")
  }

  // Enhanced getUnitDisplay with better error handling and logging
  const getUnitDisplay = () => {
    if (!selectedProduct) {
      return "Unit"
    }

    if (!selectedProduct.unit) {
      if (process.env.NODE_ENV === "development") {
        log(LogLevel.WARN, "PurchaseOrderForm", `Selected product ${selectedProduct.name} is missing unit property`)
      }
      return "Unit"
    }

    return selectedProduct.unit
  }

  // Enhanced handleAddItem with better error handling and unit verification
  const handleAddItem = () => {
    if (!selectedProduct) {
      toast({
        title: "Error",
        description: "Please select a product before adding an item.",
        variant: "destructive",
      })
      return
    }

    if (!quantity || Number.parseFloat(quantity) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity.",
        variant: "destructive",
      })
      return
    }

    if (!unitPrice || Number.parseFloat(unitPrice) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid unit price.",
        variant: "destructive",
      })
      return
    }

    const productUnit = selectedProduct.unit || "Unit"

    const newItem = {
      id: uuidv4(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_variant_id: selectedVariant?.id || null,
      product_variant_name: selectedVariant?.product_variant_name || null,
      quantity: Number.parseFloat(quantity),
      unit_price: Number.parseFloat(unitPrice),
      unit: productUnit, // Explicitly set the unit from the selected product
      total: Number.parseFloat(quantity) * Number.parseFloat(unitPrice),
    }

    if (process.env.NODE_ENV === "development") {
      log(
        LogLevel.DEBUG,
        "PurchaseOrderForm",
        `Adding item: ${newItem.product_name}, Qty: ${newItem.quantity} ${productUnit}`,
      )
    }

    setOrderItems([...orderItems, newItem])

    // Reset form fields
    setSelectedProduct(null)
    setSelectedVariant(null)
    setQuantity("")
    setUnitPrice("")

    toast({
      title: "Success",
      description: "Item added to order.",
    })
  }

  // Enhanced handleEditItem with unit preservation
  const handleEditItem = (item: any) => {
    log(LogLevel.DEBUG, "PurchaseOrderForm", "Editing item:", item)

    // Find the product and variant
    const product = products.find((p) => p.id === item.product_id)
    const variant = productVariants.find((v) => v.id === item.product_variant_id)

    if (!product) {
      log(LogLevel.ERROR, "PurchaseOrderForm", `Product with ID ${item.product_id} not found`)
      toast({
        title: "Error",
        description: "Product not found. Please try again.",
        variant: "destructive",
      })
      return
    }

    log(LogLevel.DEBUG, "PurchaseOrderForm", "Found product for edit:", product)
    log(LogLevel.DEBUG, "PurchaseOrderForm", "Product unit from database:", product.unit)

    // Filter variants for this product
    const filteredVariants = productVariants.filter((v) => v.product_id === item.product_id)

    // Set form fields with item data, ensuring unit is preserved
    setSelectedProduct({
      id: product.id,
      name: product.product_name,
      unit: product.unit || item.unit, // Use product.unit or fall back to item.unit
      variants: filteredVariants,
    })

    setSelectedVariant(variant || null)
    setQuantity(item.quantity.toString())
    setUnitPrice(item.unit_price.toString())

    // Remove the item from the list
    setOrderItems(orderItems.filter((i) => i.id !== item.id))

    log(LogLevel.DEBUG, "PurchaseOrderForm", "Updated form state for editing")
  }

  const handleDeleteItem = (id: string) => {
    setOrderItems(orderItems.filter((item) => item.id !== id))
  }

  // Add this function to handle adding a new item
  const handleAddNewItem = useCallback(() => {
    // Check if a manufacturer is selected
    if (!formData.manufacturer_id) {
      toast({
        variant: "destructive",
        title: "Manufacturer Required",
        description: "Please select a manufacturer before adding items to the order.",
      })
      return
    }

    // Show the add item form and switch to the items tab
    setShowAddItemForm(true)
    setActiveTab("items")
  }, [formData.manufacturer_id, toast, setShowAddItemForm, setActiveTab])

  const handleSendEmail = async () => {
    if (!orderId) {
      toast({
        title: "Error",
        description: "Please save the order before sending emails",
        variant: "destructive",
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

    // Check if there are any recipients selected
    if (selectedContactIds.length === 0 && selectedEmployeeIds.length === 0 && !includePrimaryContact) {
      toast({
        title: "No Recipients Selected",
        description: "Please select at least one recipient to send the email to.",
        variant: "destructive",
      })
      return
    }

    setIsSendingEmail(true)

    try {
      log(LogLevel.INFO, "PurchaseOrderForm", "Sending email manually for order:", orderId)

      // Ensure all arrays are properly initialized
      const contactIdsToSend = selectedContactIds || []
      const employeeIdsToSend = selectedEmployeeIds || []
      const emailSubjectToSend = emailSubject || `Purchase Order: ${formData.order_name}`

      const response = await fetch("/api/email/send-purchase-order-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          purchaseOrderId: orderId,
          includePrimaryContact,
          contactIds: contactIdsToSend,
          employeeIds: employeeIdsToSend,
          customMessage: customEmailMessage,
          subject: emailSubjectToSend,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Email Sent",
          description: "Purchase order confirmation email has been sent successfully",
        })

        // Refresh email logs
        const { data: logs, error: logsError } = await supabase
          .from("manufacturer_communication_logs")
          .select(`
        id,
        date_created,
        communication_method,
        subject,
        email_address,
        status,
        error_message,
        message
      `)
          .eq("purchase_order_id", orderId)
          .order("date_created", { ascending: false })

        if (logsError) {
          console.error("Error fetching email logs:", logsError)
          return
        }

        if (logs) {
          setEmailLogs(logs)
        }
      } else {
        throw new Error(data.error || "Failed to send email")
      }
    } catch (error: any) {
      log(LogLevel.ERROR, "PurchaseOrderForm", "Error sending email manually:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while sending the email",
      })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleItemRemoved = useCallback(
    (removedItem: OrderItem) => {
      // Mark this item as manually deleted
      setHasManuallyModifiedItems(true)

      // Add the item ID to the deleted items ref to prevent re-addition
      deletedItemIdsRef.current.add(removedItem.purchase_order_item_id)

      // Check if this is a transient item (added in this session)
      const isNewItem = removedItem.purchase_order_item_id.startsWith("new-")

      if (isNewItem) {
        // For new items that were added and then deleted in the same session,
        // mark them as transient so they don't affect inventory calculations
        setTransientItemIds((prev) => {
          const updated = new Set(prev)
          updated.add(removedItem.purchase_order_item_id)
          return updated
        })

        // Add the transient flag to the item
        const transientItem = { ...removedItem, isTransient: true }

        // Add to deleted items for tracking
        setDeletedOrderItems((prev) => {
          // Check if this item is already in the deleted items list
          if (!prev.some((item) => item.purchase_order_item_id === removedItem.purchase_order_item_id)) {
            return [...prev, transientItem]
          }
          return prev
        })
      } else {
        // For existing items, add to deleted items normally
        setDeletedOrderItems((prev) => {
          // Check if this item is already in the deleted items list
          if (!prev.some((item) => item.purchase_order_item_id === removedItem.purchase_order_item_id)) {
            return [...prev, removedItem]
          }
          return prev
        })
      }

      if (process.env.NODE_ENV === "development") {
        log(
          LogLevel.DEBUG,
          "PurchaseOrderForm",
          `Item removed: ${removedItem.product_name} - ${removedItem.variant_name}`,
        )
      }
    },
    [transientItemIds],
  )

  // Update the calculateInventoryChanges function to use a debounce mechanism
  // Find the calculateInventoryChanges function and replace it with this improved version
  // that properly handles negative inventory values

  // Replace the existing calculateInventoryChanges function with this updated version
  const calculateInventoryChanges = useCallback(async () => {
    if (isCalculatingInventory) return
    setIsCalculatingInventory(true)

    try {
      const changes: InventoryChange[] = []

      // Get original order items if editing
      const originalItems: Record<string, { quantity: number; pallets: number | null; layers: number | null }> = {}

      if (orderId) {
        const { data: originalOrderItems, error } = await supabase
          .from("purchase_order_items")
          .select("variant_id, quantity, pallets, layers")
          .eq("purchase_order_id", orderId)
          .eq("is_archived", false)

        if (error) {
          console.error("Error fetching original order items:", error)
          return
        }

        if (originalOrderItems) {
          originalOrderItems.forEach((item) => {
            originalItems[item.variant_id] = {
              quantity: item.quantity || 0,
              pallets: item.pallets,
              layers: item.layers,
            }
          })
        }
      }

      // Process current order items (additions to inventory - inverse of customer orders)
      for (const item of orderItems) {
        if (!item.variant_id) continue

        // Get current variant data
        const { data: variant, error } = await supabase
          .from("product_variants")
          .select(
            "product_variant_name, quantity, pallets, layers, warning_threshold, critical_threshold, products(product_name, unit, feet_per_layer, layers_per_pallet)",
          )
          .eq("id", item.variant_id)
          .single()

        if (error) {
          console.error("Error fetching product variant:", error)
          continue
        }

        if (variant) {
          // Log the variant data to verify unit information
          log(LogLevel.DEBUG, "PurchaseOrderForm", `Variant ${item.variant_id} data:`, variant)
          log(LogLevel.DEBUG, "PurchaseOrderForm", `Variant ${item.variant_id} product unit:`, variant.products?.unit)

          const currentQuantity = variant.quantity || 0
          const currentPallets = variant.pallets || 0
          const currentLayers = variant.layers || 0
          const unit = variant.products?.unit || null
          const isSpecialUnit = unit === "Square Feet" || unit === "Linear Feet"
          const feetPerLayer = variant.products?.feet_per_layer || DEFAULT_FEET_PER_LAYER
          const layersPerPallet = variant.products?.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

          // Calculate change in quantity - POSITIVE for purchase orders (adding to inventory)
          let changeQuantity = Math.ceil(item.quantity) // Ensure quantity is an integer (rounded up)
          let changePallets = isSpecialUnit && item.is_pallet ? Math.floor(item.pallets || 0) : null
          let changeLayers = isSpecialUnit && item.is_pallet ? Math.floor(item.layers || 0) : null

          // If editing, adjust for original quantities
          if (orderId && originalItems[item.variant_id]) {
            changeQuantity -= originalItems[item.variant_id].quantity

            if (isSpecialUnit && item.is_pallet && originalItems[item.variant_id].pallets !== null) {
              changePallets = Math.floor(item.pallets || 0) - Math.floor(originalItems[item.variant_id].pallets!)
            }

            if (isSpecialUnit && item.is_pallet && originalItems[item.variant_id].layers !== null) {
              changeLayers = Math.floor(item.layers || 0) - Math.floor(originalItems[item.variant_id].layers!)
            }
          }

          // Use the new utility function to calculate inventory impact
          const { newQuantity, newPallets, newLayers } = calculateInventoryImpact(
            currentQuantity,
            currentPallets,
            currentLayers,
            changeQuantity,
            changePallets,
            changeLayers,
            feetPerLayer,
            layersPerPallet,
            isSpecialUnit && item.is_pallet && changePallets !== null && changeLayers !== null,
          )

          changes.push({
            variant_id: item.variant_id,
            variant_name: variant.product_variant_name,
            product_name: variant.products?.product_name || "",
            unit: variant.products?.unit || "Each", // Always use product's unit
            current_quantity: currentQuantity,
            current_pallets: isSpecialUnit ? currentPallets : null,
            current_layers: isSpecialUnit ? currentLayers : null,
            change_quantity: changeQuantity,
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
          })
        }
      }

      // Process deleted items (subtractions from inventory - inverse of customer orders)
      for (const item of deletedOrderItems) {
        if (!item.variant_id) continue

        // Skip transient items (added and then deleted in the same session)
        if (transientItemIds.has(item.purchase_order_item_id)) {
          log(
            LogLevel.DEBUG,
            "PurchaseOrderForm",
            `Skipping transient item in inventory calculation: ${item.purchase_order_item_id}`,
          )
          continue
        }

        // Get current variant data
        const { data: variant, error } = await supabase
          .from("product_variants")
          .select(
            "product_variant_name, quantity, pallets, layers, warning_threshold, critical_threshold, products(product_name, unit, feet_per_layer, layers_per_pallet)",
          )
          .eq("id", item.variant_id)
          .single()

        if (error) {
          console.error("Error fetching product variant:", error)
          throw error
        }

        if (variant) {
          const currentQuantity = variant.quantity || 0
          const currentPallets = variant.pallets || 0
          const currentLayers = variant.layers || 0
          const unit = variant.products?.unit || null
          const isSpecialUnit = unit === "Square Feet" || unit === "Linear Feet"
          const feetPerLayer = variant.products?.feet_per_layer || DEFAULT_FEET_PER_LAYER
          const layersPerPallet = variant.products?.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

          // For deleted items, we're subtracting from inventory (inverse of customer orders)
          const changeQuantity = -Math.ceil(item.quantity) // Negative because we're removing
          const changePallets = isSpecialUnit && item.is_pallet ? -Math.floor(item.pallets || 0) : null
          const changeLayers = isSpecialUnit && item.is_pallet ? -Math.floor(item.layers || 0) : null

          // Use the new utility function to calculate inventory impact
          const { newQuantity, newPallets, newLayers } = calculateInventoryImpact(
            currentQuantity,
            currentPallets,
            currentLayers,
            changeQuantity,
            changePallets,
            changeLayers,
            feetPerLayer,
            layersPerPallet,
            isSpecialUnit && item.is_pallet && changePallets !== null && changeLayers !== null,
          )

          changes.push({
            variant_id: item.variant_id,
            variant_name: item.variant_name,
            product_name: item.product_name,
            unit,
            current_quantity: currentQuantity,
            current_pallets: isSpecialUnit ? currentPallets : null,
            current_layers: isSpecialUnit ? currentLayers : null,
            change_quantity: changeQuantity, // Negative value to indicate subtraction
            change_pallets: changePallets, // Negative value to indicate subtraction
            change_layers: changeLayers, // Negative value to indicate subtraction
            new_quantity: newQuantity,
            new_pallets: newPallets,
            new_layers: newLayers,
            warning_threshold: variant.warning_threshold,
            critical_threshold: variant.critical_threshold,
            feet_per_layer: feetPerLayer,
            layers_per_pallet: layersPerPallet,
            is_deleted: true, // Mark as deleted for UI display
            isTransient: item.isTransient, // Pass through the transient flag
          })
        }
      }

      setInventoryChanges(changes)
    } catch (error) {
      console.error("Error calculating inventory changes:", error)
    } finally {
      // Use setTimeout to ensure state updates don't cascade immediately
      setTimeout(() => {
        setIsCalculatingInventory(false)
      }, 100)
    }
  }, [deletedOrderItems, isCalculatingInventory, orderId, orderItems, supabase, transientItemIds])

  // Update the useEffect that calls calculateInventoryChanges to use a debounce
  useEffect(() => {
    if (orderItems.length > 0 || deletedOrderItems.length > 0) {
      // Use a debounce to prevent rapid consecutive calls
      const timeoutId = setTimeout(() => {
        calculateInventoryChanges()
      }, 300)

      return () => clearTimeout(timeoutId)
    } else {
      setInventoryChanges([])
    }
  }, [orderItems, deletedOrderItems, calculateInventoryChanges])

  const calculateOrderTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.total || item.total_order_item_value || 0), 0)
    const total = subtotal // Total is now just the subtotal without tax

    return { subtotal, total }
  }

  const { subtotal, total } = calculateOrderTotals()

  // Add this function after the calculateOrderTotals function
  const manufacturerHasEmail = useCallback(() => {
    const selectedManufacturer = manufacturers.find((m) => m.id === formData.manufacturer_id)
    return !!selectedManufacturer?.email
  }, [manufacturers, formData.manufacturer_id])

  // Add this function after the manufacturerHasEmail function
  const sendOrderConfirmationEmail = async (
    purchaseOrderId: string,
    contactIds: string[] = [],
    employeeIds: string[] = [],
    includePrimaryContact = false,
    customMessage?: string,
    subject?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/email/send-purchase-order-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          purchaseOrderId,
          includePrimaryContact,
          contactIds,
          employeeIds,
          customMessage,
          subject,
        }),
      })

      const data = await response.json()
      return { success: data.success, error: data.error }
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to send email" }
    }
  }

  // Add this helper function to properly calculate inventory updates
  const calculateUpdatedInventory = (
    currentQuantity: number,
    currentPallets: number,
    currentLayers: number,
    changeQuantity: number,
    changePallets: number | null,
    changeLayers: number | null,
    isSpecialUnit: boolean,
    feetPerLayer: number,
    layersPerPallet: number,
  ) => {
    // For non-special units, just add the quantities
    if (!isSpecialUnit) {
      return {
        quantity: currentQuantity + changeQuantity,
        pallets: currentPallets,
        layers: currentLayers,
      }
    }

    // For special units, calculate using total layers
    // Convert current inventory to total layers
    const currentTotalLayers = currentPallets * layersPerPallet + currentLayers

    // Calculate change in total layers
    let changeTotalLayers = 0
    if (changePallets !== null && changeLayers !== null) {
      changeTotalLayers = changePallets * layersPerPallet + changeLayers
    } else {
      // Calculate from quantity if pallets/layers not provided
      changeTotalLayers = Math.ceil(changeQuantity / feetPerLayer)
    }

    // Calculate new total layers
    const newTotalLayers = currentTotalLayers + changeTotalLayers

    // Handle case where new_total_layers is negative
    if (newTotalLayers < 0) {
      // For negative total layers, calculate pallets and layers differently
      const newPallets = Math.floor(newTotalLayers / layersPerPallet)
      const remainderLayers = Math.abs(newTotalLayers % layersPerPallet)

      // If there's a remainder, adjust pallets and layers
      let newLayers = 0
      if (remainderLayers > 0) {
        newLayers = layersPerPallet - remainderLayers
        // Adjust pallets down by 1 to account for the borrowed layer
        const adjustedPallets = newPallets - 1

        // Recalculate quantity based on the new pallets and layers
        const newQuantity = (adjustedPallets * layersPerPallet + newLayers) * feetPerLayer

        return {
          quantity: newQuantity,
          pallets: adjustedPallets,
          layers: newLayers,
        }
      } else {
        // No remainder, just use the calculated values
        const newQuantity = newTotalLayers * feetPerLayer

        return {
          quantity: newQuantity,
          pallets: newPallets,
          layers: newLayers,
        }
      }
    } else {
      // For positive total layers, standard calculation
      const newPallets = Math.floor(newTotalLayers / layersPerPallet)
      const newLayers = newTotalLayers % layersPerPallet

      // Ensure quantity matches the calculated pallets and layers
      const newQuantity = newTotalLayers * feetPerLayer

      return {
        quantity: newQuantity,
        pallets: newPallets,
        layers: newLayers,
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate order name format
    if (!validateOrderName(formData.order_name)) {
      toast({
        variant: "destructive",
        title: "Invalid Order Name Format",
        description: "Order name must follow the format: PO-YYYYMMDD-XXXXXX-YYYYYY",
      })
      return
    }

    if (!formData.manufacturer_id) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a manufacturer",
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
      const timestamp = getCurrentTimestamp()
      const userId = (await supabase.auth.getUser()).data.user?.id

      // Use the custom time input if it's shown and has a value
      const finalDeliveryTime = showCustomTimeInput && customTimeInput ? customTimeInput : formData.delivery_time

      // Combine form data and order items for submission
      const purchaseOrderData = {
        ...formData,
        delivery_time: finalDeliveryTime,
        subtotal_order_value: subtotal,
        total_order_value: total,
        date_last_updated: timestamp,
        updated_by_user_id: userId,
        send_email: enableEmailNotifications,
      }

      log(LogLevel.DEBUG, "PurchaseOrderForm", "Form submitted:", purchaseOrderData)

      // Create or update the purchase order
      let purchaseOrderId = orderId

      if (purchaseOrderId) {
        // Update existing order
        const { error } = await supabase.from("purchase_orders").update(purchaseOrderData).eq("id", purchaseOrderId)

        if (error) throw error
      } else {
        // Create new order
        const newOrderId = uuidv4()
        const { error } = await supabase.from("purchase_orders").insert({
          id: newOrderId,
          ...purchaseOrderData,
          date_created: timestamp,
          created_by_user_id: userId,
        })

        if (error) throw error
        purchaseOrderId = newOrderId
      }

      if (!purchaseOrderId) {
        throw new Error("Failed to create or update purchase order")
      }

      // Track processed item IDs to prevent archiving newly created items
      const processedItemIds = new Set<string>()

      // Process order items
      for (const item of orderItems) {
        // Skip items that have been marked as deleted or don't have a valid ID
        if (!item.purchase_order_item_id || deletedItemIdsRef.current.has(item.purchase_order_item_id)) {
          log(
            LogLevel.DEBUG,
            "PurchaseOrderForm",
            `Skipping invalid or deleted item: ${item.purchase_order_item_id || "unknown"}`,
          )
          continue
        }

        // Ensure quantity, pallets, and layers are integers
        const processedItem = {
          ...item,
          quantity: Math.ceil(item.quantity), // Round up quantity
          pallets: Math.floor(item.pallets || 0), // Always include pallets, default to 0
          layers: Math.floor(item.layers || 0), // Always include layers, default to 0
        }

        // Find the product to get its unit
        const product = products.find((p) => p.id === item.product_id)
        log(LogLevel.DEBUG, "PurchaseOrderForm", `Saving item ${item.purchase_order_item_id} with product:`, product)
        log(LogLevel.DEBUG, "PurchaseOrderForm", `Product unit for item ${item.purchase_order_item_id}:`, product?.unit)

        const itemData = {
          purchase_order_id: purchaseOrderId,
          product_id: processedItem.product_id,
          variant_id: processedItem.variant_id,
          quantity: processedItem.quantity,
          unit_price: processedItem.unit_price,
          discount_percentage: processedItem.discount_percentage,
          total_order_item_value: processedItem.total || processedItem.total_order_item_value,
          is_pallet: processedItem.is_pallet || false,
          pallets: processedItem.pallets, // Always include pallets
          layers: processedItem.layers, // Always include layers
          date_last_updated: timestamp,
          updated_by_user_id: userId,
        }

        let finalItemId: string

        if (item.purchase_order_item_id.startsWith("new-")) {
          // Insert new item
          const newItemId = uuidv4()
          const { error } = await supabase.from("purchase_order_items").insert({
            purchase_order_item_id: newItemId,
            ...itemData,
            date_created: timestamp,
            created_by_user_id: userId,
            is_archived: false, // Explicitly set to false for new items
          })

          if (error) {
            console.error("Error inserting order item:", error)
            throw error
          }

          finalItemId = newItemId
          log(
            LogLevel.DEBUG,
            "PurchaseOrderForm",
            `Created new item with ID ${newItemId} from temporary ID ${item.purchase_order_item_id}`,
          )
        } else {
          // Update existing item
          const { error } = await supabase
            .from("purchase_order_items")
            .update(itemData)
            .eq("purchase_order_item_id", item.purchase_order_item_id)

          if (error) {
            console.error("Error updating order item:", error)
            throw error
          }

          finalItemId = item.purchase_order_item_id
        }

        // Track this item as processed to prevent it from being archived
        processedItemIds.add(finalItemId)
      }

      // Only run the archiving logic if we're editing an existing order
      if (orderId) {
        log(LogLevel.DEBUG, "PurchaseOrderForm", "Processing deletions for existing order")

        // Get existing items to check for deleted ones
        const { data: existingItems, error } = await supabase
          .from("purchase_order_items")
          .select("purchase_order_item_id")
          .eq("purchase_order_id", purchaseOrderId)
          .eq("is_archived", false)

        if (error) {
          console.error("Error fetching existing order items:", error)
          throw error
        }

        if (existingItems && existingItems.length > 0) {
          // Find items that exist in the database but weren't processed in this submission
          const itemsToDelete = existingItems
            .filter((item) => !processedItemIds.has(item.purchase_order_item_id))
            .map((item) => item.purchase_order_item_id)

          log(LogLevel.DEBUG, "PurchaseOrderForm", `Found ${itemsToDelete.length} items to archive`)

          // Soft delete removed items
          for (const itemId of itemsToDelete) {
            const { error } = await supabase
              .from("purchase_order_items")
              .update({
                is_archived: true,
                date_last_updated: timestamp,
                updated_by_user_id: userId,
              })
              .eq("purchase_order_item_id", itemId)

            if (error) {
              console.error("Error soft deleting order item:", error)
              throw error
            }

            // Add to our deleted items tracking
            deletedItemIdsRef.current.add(itemId)
          }
        } else {
          log(LogLevel.DEBUG, "PurchaseOrderForm", "No existing items found to check for deletion")
        }
      } else {
        log(LogLevel.DEBUG, "PurchaseOrderForm", "Skipping deletion check for new order")
      }

      // Save email recipients
      if (enableEmailNotifications) {
        // First, delete existing recipients
        const { error } = await supabase
          .from("purchase_order_email_recipients")
          .delete()
          .eq("purchase_order_id", purchaseOrderId)

        if (error) {
          console.error("Error deleting existing email recipients:", error)
          throw error
        }

        // Add contact recipients
        const contactRecipients = selectedContactIds.map((contactId) => ({
          purchase_order_id: purchaseOrderId,
          contact_id: contactId,
          recipient_type: "contact",
          include_primary_contact: false,
          date_created: timestamp,
          created_by_user_id: userId,
        }))

        // Add primary contact flag to the first contact (or create a record if no contacts)
        if (contactRecipients.length > 0) {
          contactRecipients[0].include_primary_contact = includePrimaryContact
        } else if (includePrimaryContact) {
          contactRecipients.push({
            purchase_order_id: purchaseOrderId,
            contact_id: null,
            recipient_type: "contact",
            include_primary_contact: true,
            date_created: timestamp,
            created_by_user_id: userId,
            date_created: timestamp,
            created_by_user_id: userId,
          })
        }

        if (contactRecipients.length > 0) {
          const { error } = await supabase.from("purchase_order_email_recipients").insert(contactRecipients)

          if (error) {
            console.error("Error inserting contact recipients:", error)
            throw error
          }
        }

        // Add employee recipients
        const employeeRecipients = selectedEmployeeIds.map((employeeId) => ({
          purchase_order_id: purchaseOrderId,
          employee_id: employeeId,
          recipient_type: "employee",
          date_created: timestamp,
          created_by_user_id: userId,
        }))

        if (employeeRecipients.length > 0) {
          const { error } = await supabase.from("purchase_order_email_recipients").insert(employeeRecipients)

          if (error) {
            console.error("Error inserting employee recipients:", error)
            throw error
          }
        }
      }

      // Update inventory for variants with changes
      if (inventoryChanges.length > 0) {
        log(LogLevel.INFO, "PurchaseOrderForm", `Processing inventory updates for ${inventoryChanges.length} variants`)

        // Filter out variants with no changes and transient items
        const variantsToUpdate = inventoryChanges.filter(
          (change) =>
            !change.isTransient &&
            (change.change_quantity !== 0 ||
              (change.change_pallets !== null && change.change_pallets !== 0) ||
              (change.change_layers !== null && change.change_layers !== 0)),
        )

        log(
          LogLevel.INFO,
          "PurchaseOrderForm",
          `Found ${variantsToUpdate.length} variants with actual changes to update`,
        )

        // Update each variant in the database
        for (const change of variantsToUpdate) {
          try {
            // Calculate new values directly from current + change
            const isDeleted = change.is_deleted === true
            const isSpecialUnit = change.unit === "Square Feet" || change.unit === "Linear Feet"

            // Calculate new quantity
            const newQuantity = change.current_quantity + (isDeleted ? -change.change_quantity : change.change_quantity)

            // Calculate new pallets and layers
            let newPallets = change.current_pallets || 0
            let newLayers = change.current_layers || 0

            if (isSpecialUnit && change.feet_per_layer && change.layers_per_pallet) {
              // Convert current inventory to total layers
              const currentTotalLayers =
                (change.current_pallets || 0) * change.layers_per_pallet + (change.current_layers || 0)

              // Calculate change in total layers
              const changeInLayers = isDeleted
                ? -(change.change_pallets || 0) * change.layers_per_pallet - (change.change_layers || 0)
                : (change.change_pallets || 0) * change.layers_per_pallet + (change.change_layers || 0)

              // Calculate new total layers
              const newTotalLayers = currentTotalLayers + changeInLayers

              // Convert back to pallets and layers
              newPallets = Math.max(0, Math.floor(newTotalLayers / change.layers_per_pallet))
              newLayers = Math.max(0, newTotalLayers % change.layers_per_pallet)
            }

            log(LogLevel.DEBUG, "PurchaseOrderForm", `Updating variant ${change.variant_id}:`, {
              current: {
                quantity: change.current_quantity,
                pallets: change.current_pallets,
                layers: change.current_layers,
              },
              change: {
                quantity: change.change_quantity,
                pallets: change.change_pallets,
                layers: change.change_layers,
              },
              calculated: { quantity: newQuantity, pallets: newPallets, layers: newLayers },
            })

            const { error } = await supabase
              .from("product_variants")
              .update({
                quantity: Math.max(0, newQuantity), // Ensure quantity is never negative
                pallets: newPallets,
                layers: newLayers,
                date_last_updated: timestamp,
                updated_by_user_id: userId,
              })
              .eq("id", change.variant_id)

            if (error) {
              log(LogLevel.ERROR, "PurchaseOrderForm", `Error updating variant ${change.variant_id}:`, error)
              console.error(`Error updating inventory for variant ${change.variant_id}:`, error)
            } else {
              log(LogLevel.INFO, "PurchaseOrderForm", `Successfully updated inventory for variant ${change.variant_id}`)
            }
          } catch (error) {
            log(LogLevel.ERROR, "PurchaseOrderForm", `Exception updating variant ${change.variant_id}:`, error)
            console.error(`Exception updating inventory for variant ${change.variant_id}:`, error)
          }
        }

        // Log variants that were skipped (no changes)
        const skippedVariants = inventoryChanges.filter(
          (change) =>
            !change.isTransient &&
            change.change_quantity === 0 &&
            (change.change_pallets === null || change.change_pallets === 0) &&
            (change.change_layers === null || change.change_layers === 0),
        )

        if (skippedVariants.length > 0) {
          log(LogLevel.INFO, "PurchaseOrderForm", `Skipped updating ${skippedVariants.length} variants with no changes`)
        }
      }

      // Inside the handleSubmit function, before sending the email:
      // Fetch app settings to get the email sender name
      const { data: appSettings, error: appSettingsError } = await supabase
        .from("app_settings")
        .select("email_sender")
        .single()

      if (appSettingsError) {
        console.error("Error fetching app settings:", appSettingsError)
        // Continue with default sender name if settings can't be fetched
      }

      // Get the sender name from app settings or use default
      const senderName = appSettings?.email_sender || "Trade Supply Manager"
      console.log(`Using sender name from app_settings: ${senderName}`)

      // Send email if requested and notifications are enabled
      if (enableEmailNotifications && formData.send_email) {
        setIsSendingEmail(true)
        try {
          // Log the attempt to send email
          log(LogLevel.INFO, "PurchaseOrderForm", "Attempting to send purchase order confirmation email", {
            orderId: purchaseOrderId,
            contactCount: selectedContactIds.length,
            employeeCount: selectedEmployeeIds.length,
            includePrimaryContact,
          })

          // Make sure all parameters are properly defined before passing them
          const emailContactIds = selectedContactIds || []
          const emailEmployeeIds = selectedEmployeeIds || []
          const emailSubjectToSend = emailSubject || `Purchase Order: ${formData.order_name}`

          const { success, error } = await sendOrderConfirmationEmail(
            purchaseOrderId!,
            emailContactIds,
            emailEmployeeIds,
            includePrimaryContact,
            customEmailMessage,
            emailSubjectToSend,
          )

          if (!success) {
            log(LogLevel.ERROR, "PurchaseOrderForm", "Error sending order confirmation email:", error)
            toast({
              variant: "warning",
              title: "Email Not Sent",
              description: error || "Could not send confirmation email. The purchase order was saved successfully.",
            })
          } else {
            log(LogLevel.INFO, "PurchaseOrderForm", "Email sent successfully")
            // No need for an additional toast as the main success toast will already be shown
          }
        } catch (emailError: any) {
          log(LogLevel.ERROR, "PurchaseOrderForm", "Error sending order confirmation email:", emailError)
          toast({
            variant: "warning",
            title: "Email Not Sent",
            description: "Could not send confirmation email. The purchase order was saved successfully.",
          })
        } finally {
          setIsSendingEmail(false)
        }
      }

      // Add debugging to verify toast is being triggered
      console.log("Showing purchase order toast:", {
        title: isEditing ? "Purchase Order Updated" : "Purchase Order Created",
        time: new Date().toISOString(),
      })

      toast({
        title: isEditing ? "Purchase Order Updated" : "Purchase Order Created",
        description:
          enableEmailNotifications && formData.send_email
            ? `The purchase order has been ${isEditing ? "updated" : "created"} successfully and confirmation emails have been sent.`
            : `The purchase order has been ${isEditing ? "updated" : "created"} successfully.`,
        duration: 3000, // Explicitly set duration to 3 seconds
      })

      // Navigate back to the purchase orders list with increased delay
      setTimeout(() => {
        router.push("/dashboard/purchase-orders")
      }, 800) // Increased from 500ms to 800ms
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while saving the purchase order",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  // Get selected options for SearchableSelect
  const selectedManufacturerOption = formData.manufacturer_id
    ? { value: formData.manufacturer_id, label: selectedManufacturer?.manufacturer_name || "" }
    : null

  // Display initialization error if any
  if (initializationError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        <h3 className="font-bold">Error Initializing Form</h3>
        <p>{initializationError}</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/dashboard/purchase-orders")}>
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
              {/* Manufacturer field on its own row */}
              <div className="w-full">
                <Label htmlFor="manufacturer_id">Manufacturer *</Label>
                <SearchableSelect
                  id="manufacturer_id"
                  value={
                    formData.manufacturer_id
                      ? {
                          value: formData.manufacturer_id,
                          label:
                            manufacturers.find((m) => m.id === formData.manufacturer_id)?.manufacturer_name ||
                            "Unknown Manufacturer",
                        }
                      : null
                  }
                  onChange={(option) => handleSelectChange("manufacturer_id", option?.value || "")}
                  options={manufacturers.map((manufacturer) => ({
                    value: manufacturer.id,
                    label: manufacturer.manufacturer_name,
                  }))}
                  placeholder="Select manufacturer"
                  formatOptionLabel={(option) => (
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium truncate">{option.label}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded ml-2">
                          ID: {option.value.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  )}
                />
              </div>

              {/* Order Status, Payment Status, Amount Paid in a single row */}
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

                <div className="col-span-4 space-y-2">
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

              {/* Address and Instructions */}
              <div className="space-y-2">
                <Label htmlFor="delivery_address">Delivery Address</Label>
                <Textarea
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

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} />
              </div>
            </CardContent>
          </Card>

          {/* Order Summary Card */}
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
                <div>
                  <Label>Total:</Label>
                  <div className="text-xl font-bold">{formatCurrency(total)}</div>
                </div>
                <div>
                  <Label>Amount Paid:</Label>
                  <div className="font-medium">{formatCurrency(formData.amount_paid)}</div>
                </div>
                <div>
                  <Label>Balance Due:</Label>
                  <div className="font-medium">{formatCurrency(Math.max(0, total - formData.amount_paid))}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          {process.env.NODE_ENV === "development" &&
            (() => {
              // Debug the variants being passed to PurchaseOrderItems
              debugVariantFlow("Variants passed to PurchaseOrderItems", productVariants)

              // Check if there are any variants for the selected manufacturer
              if (formData.manufacturer_id) {
                const manufacturerProducts = products.filter((p) => p.manufacturer_id === formData.manufacturer_id)
                const manufacturerProductIds = manufacturerProducts.map((p) => p.id)
                const manufacturerVariants = productVariants.filter((v) =>
                  manufacturerProductIds.includes(v.product_id),
                )

                debugVariantFlow(
                  `Variants for selected manufacturer (${formData.manufacturer_id})`,
                  manufacturerVariants,
                  "manufacturer filter",
                )

                // Check for variants with negative quantities for this manufacturer
                const negativeQuantityVariants = manufacturerVariants.filter(
                  (v) => v.quantity !== null && v.quantity < 0,
                )

                if (negativeQuantityVariants.length > 0) {
                  console.log(
                    `Found ${negativeQuantityVariants.length} variants with negative quantities for this manufacturer`,
                  )
                }
              }

              return null
            })()}
          <PurchaseOrderItems
            products={filteredProducts}
            orderItems={orderItems}
            setOrderItems={setOrderItems}
            deletedOrderItems={deletedOrderItems}
            setDeletedOrderItems={setDeletedOrderItems}
            transientItemIds={transientItemIds}
            setTransientItemIds={setTransientItemIds}
            hasManuallyModifiedItems={hasManuallyModifiedItems}
            setHasManuallyModifiedItems={setHasManuallyModifiedItems}
            selectedManufacturerId={formData.manufacturer_id}
            onItemRemoved={handleItemRemoved}
            showAddItemForm={showAddItemForm}
            setShowAddItemForm={setShowAddItemForm}
            productVariants={productVariants} // Add debugging before passing this prop
          />

          <Card>
            <CardContent className="mt-6 pt-4">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between py-1 font-bold">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <InventoryImpactTable inventoryChanges={inventoryChanges} />
        </TabsContent>

        <TabsContent value="emails">
          <EmailRecipientsTab
            manufacturerId={formData.manufacturer_id}
            orderId={orderId || ""}
            selectedContactIds={selectedContactIds}
            onContactsChange={handleContactsChange}
            selectedEmployeeIds={selectedEmployeeIds}
            onEmployeesChange={handleEmployeesChange}
            manufacturerEmail={selectedManufacturer?.email}
            manufacturerName={selectedManufacturer?.manufacturer_name}
            enableEmailNotifications={enableEmailNotifications}
            onToggleEmailNotifications={handleToggleEmailNotifications}
            onSendEmail={(customMessage, subject) => {
              setCustomEmailMessage(customMessage || "")
              if (subject) setEmailSubject(subject)
              handleSendEmail()
            }}
            isSending={isSendingEmail}
            defaultSubject={`Purchase Order: ${formData.order_name}`}
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
