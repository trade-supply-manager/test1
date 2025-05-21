"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PlusCircle, Trash2, Edit, X, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { v4 as uuidv4 } from "uuid"
import type { SearchableSelectOption } from "@/components/ui/searchable-select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useToast } from "@/hooks/use-toast"
import { log, LogLevel } from "@/lib/debug-utils"

// Add this debugging function at the top of the file, after the imports
const debugVariantFlow = (location: string, variants: any[], filter?: string) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `%c[VARIANT FLOW DEBUG] ${location} ${filter ? `(${filter})` : ""}`,
      "background: #673ab7; color: white; padding: 2px 5px; border-radius: 3px;",
    )

    console.log(`Total variants: ${variants.length}`)
  }
}

interface Manufacturer {
  id: string
  manufacturer_name: string
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
  product_id: string
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
  purchase_order_item_id?: string
  product_id: string
  variant_id: string
  product_name: string
  variant_name: string
  variant_sku?: string
  unit_price: number
  quantity: number
  discount_percentage: number
  discount: number
  total: number
  total_order_item_value: number
  is_pallet: boolean
  pallets: number | null
  layers: number | null
  unit: string | null // For display purposes only - not saved to database
  feet_per_layer: number | null
  layers_per_pallet: number | null
  isTransient?: boolean
}

interface PurchaseOrderItemsProps {
  products: Product[]
  orderItems: OrderItem[]
  setOrderItems: React.Dispatch<React.SetStateAction<OrderItem[]>>
  deletedOrderItems: OrderItem[]
  setDeletedOrderItems: React.Dispatch<React.SetStateAction<OrderItem[]>>
  transientItemIds: Set<string>
  setTransientItemIds: React.Dispatch<React.SetStateAction<Set<string>>>
  hasManuallyModifiedItems: boolean
  setHasManuallyModifiedItems: React.Dispatch<React.SetStateAction<boolean>>
  selectedManufacturerId: string
  onItemRemoved: (item: OrderItem) => void
  showAddItemForm: boolean
  setShowAddItemForm: React.Dispatch<React.SetStateAction<boolean>>
  productVariants: ProductVariant[] // Add this line to receive product variants
}

// Default conversion rates
const DEFAULT_FEET_PER_LAYER = 100
const DEFAULT_LAYERS_PER_PALLET = 10
const DEFAULT_UNIT = "Each"

// Debug utility function
const debugLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV === "development") {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [PurchaseOrderItems] 🔍 ${message}`, data !== undefined ? data : "")
  }
}

// Add a specialized variant debug logger
const debugVariants = (location: string, variants: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `%c[VARIANT DEBUG] ${location}`,
      "background: #ffeb3b; color: #000; padding: 2px 5px; border-radius: 3px;",
    )
    console.table(
      variants.map((v) => ({
        id: v.id?.substring(0, 8) || "N/A",
        name: v.product_variant_name || v.label || "N/A",
        quantity: v.quantity !== undefined ? v.quantity : "N/A",
        product_id: v.product_id?.substring(0, 8) || "N/A",
      })),
    )
  }
}

// Add a helper function to check if a unit is a special unit
// Add this after the other utility functions at the top of the component

const isSpecialUnit = (unit: string | null): boolean => {
  return unit === "Square Feet" || unit === "Linear Feet"
}

// Modify the AddItemForm component to add debugging for the productVariants prop
const AddItemForm = ({
  products,
  onAddItem,
  onCancel,
  selectedManufacturerId,
  productVariants,
  editingItemId = null,
  itemToEdit = null,
  onItemEdited = () => {},
}: {
  products: Product[]
  onAddItem: (item: OrderItem) => void
  onCancel: () => void
  selectedManufacturerId: string
  productVariants: ProductVariant[]
  editingItemId?: string | null
  itemToEdit?: OrderItem | null
  onItemEdited?: (item: OrderItem) => void
}) => {
  // Add this at the beginning of the component
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      debugVariantFlow("AddItemForm received productVariants", productVariants)
    }
  }, [productVariants])

  // Add this line to define the toast variable in the AddItemForm component
  const { toast } = useToast()

  // Track user edits and prevent automatic recalculations from overriding user input
  const userEditingRef = useRef({
    isEditing: false,
    field: null as string | null,
    lastValues: {
      quantity: 0,
      pallets: 0,
      layers: 0,
    },
  })

  // Track if the form has been initialized with item data
  const formInitializedRef = useRef(false)

  // Add debug logging at component initialization
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      debugLog("AddItemForm initialized", {
        productsCount: products?.length || 0,
        variantsCount: productVariants?.length || 0,
        editingItemId,
        itemToEdit: itemToEdit
          ? {
              id: itemToEdit.purchase_order_item_id,
              product: itemToEdit.product_name,
              quantity: itemToEdit.quantity,
              is_pallet: itemToEdit.is_pallet,
            }
          : null,
      })

      // Debug all product variants received
      debugVariants("Initial productVariants prop", productVariants)
    }
  }, [products, productVariants, selectedManufacturerId, editingItemId, itemToEdit])

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [availableVariants, setAvailableVariants] = useState<ProductVariant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState<number>(0)
  const [pallets, setPallets] = useState<number>(0)
  const [layers, setLayers] = useState<number>(0)
  const [discountPercentage, setDiscountPercentage] = useState<number>(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Add a state to track if calculations should be skipped
  const [skipCalculations, setSkipCalculations] = useState(false)

  // First, add a state to track whether rounding is enabled in the AddItemForm component
  // Add this after the other useState declarations in the AddItemForm component
  const [roundingEnabled, setRoundingEnabled] = useState<boolean>(true)

  // Effect to populate form when editing an item
  useEffect(() => {
    if (itemToEdit && editingItemId && !formInitializedRef.current) {
      // Set the form as initialized to prevent re-initialization
      formInitializedRef.current = true

      // Temporarily disable calculations during initialization
      setSkipCalculations(true)

      try {
        // Find the product
        const product = products.find((p) => p.id === itemToEdit.product_id)
        if (!product) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`Product with ID ${itemToEdit.product_id} not found for editing`)
          }
          return
        }

        // Set product category if available
        if (product.product_category) {
          setSelectedCategory(product.product_category)
        }

        // Set selected product
        setSelectedProductId(itemToEdit.product_id)

        // Get variants for this product
        const matchingVariants = productVariants.filter((v) => v.product_id === itemToEdit.product_id)
        setAvailableVariants(matchingVariants)

        // Set selected variant
        setSelectedVariantId(itemToEdit.variant_id)

        // Set quantity and discount
        setQuantity(itemToEdit.quantity)

        // Store the initial values in the userEditingRef
        userEditingRef.current.lastValues = {
          quantity: itemToEdit.quantity,
          pallets: itemToEdit.pallets || 0,
          layers: itemToEdit.layers || 0,
        }

        setDiscountPercentage(itemToEdit.discount_percentage)

        // Set pallets and layers if applicable
        setPallets(itemToEdit.pallets || 0)
        setLayers(itemToEdit.layers || 0)

        if (process.env.NODE_ENV === "development") {
          debugLog("Form populated for editing item:", {
            product: product.product_name,
            variant: itemToEdit.variant_name,
            quantity: itemToEdit.quantity,
            pallets: itemToEdit.pallets,
            layers: itemToEdit.layers,
          })
        }
      } catch (error) {
        console.error("Error initializing form with item data:", error)
      } finally {
        // Re-enable calculations after initialization
        setTimeout(() => {
          setSkipCalculations(false)
        }, 100)
      }
    }
  }, [itemToEdit, editingItemId, products, productVariants])

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.product_category))].sort()
  }, [products])

  // Filter products by category and manufacturer
  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.manufacturer_id === selectedManufacturerId && (!selectedCategory || p.product_category === selectedCategory),
    )
  }, [products, selectedManufacturerId, selectedCategory])

  // Convert categories to options for SearchableSelect
  const categoryOptions = useMemo<SearchableSelectOption[]>(() => {
    const options = [{ value: "all", label: "All Categories" }]
    categories.forEach((category) => {
      options.push({
        value: category || "uncategorized",
        label: category || "Uncategorized",
      })
    })
    return options
  }, [categories])

  // Convert products to options for SearchableSelect
  const productOptions = useMemo<SearchableSelectOption[]>(() => {
    return filteredProducts.map((product) => ({
      value: product.id,
      label: product.product_name,
      description: product.unit || "No unit specified",
    }))
  }, [filteredProducts])

  // Enhanced handleProductChange with better logging and variant handling
  const handleProductChange = (option: SearchableSelectOption | null) => {
    const productId = option?.value || null
    setSelectedProductId(productId)

    if (!productId) {
      setAvailableVariants([])
      setSelectedVariantId(null)
      return
    }

    // Find the selected product (from the 'products' prop)
    const product = products.find((p) => p.id === productId)

    if (product) {
      // *** CRITICAL STEP: Log the full productVariants prop *before* filtering ***
      debugVariantFlow("[Add Item Form] Full variants list before filtering", productVariants) // Use the debug function

      // Filter variants from the *prop*
      const matchingVariants = productVariants.filter((v) => {
        // Simple match check without logging
        return v.product_id === productId
      })
      debugVariantFlow(
        `[Add Item Form] Matching variants for ${product.product_name}`,
        matchingVariants,
        "product_id filter",
      ) // Use the debug function

      // Ensure all variants have valid IDs (this check seems okay but good to log)
      const validVariants = matchingVariants.filter((v) => v.id && v.id.trim() !== "")
      debugVariantFlow(`[Add Item Form] Valid variants for ${product.product_name}`, validVariants, "ID validation") // Use the debug function

      if (validVariants.length === 0) {
        console.warn(
          `[Add Item Form] No valid variants found for product ${product.product_name}. Check filtering logic and data.`,
        )
      }

      setAvailableVariants(validVariants)
    } else {
      console.warn(`[Add Item Form] Product with ID ${productId} not found in products array. Resetting variants.`)
      setAvailableVariants([])
    }

    // Reset variant selection and other fields
    setSelectedVariantId(null)
    setQuantity(0)
    setPallets(0)
    setLayers(0)
  }

  // Convert variants to options for SearchableSelect
  const variantOptions = useMemo<SearchableSelectOption[]>(() => {
    // Debug what variants are available for the dropdown
    debugVariants("Available variants for dropdown (from state)", availableVariants)

    const options = availableVariants.map((variant) => ({
      value: variant.id,
      label: variant.product_variant_name || "Unnamed Variant",
      description: variant.product_variant_sku || "No SKU",
      // Store the quantity for debugging
      _debug_quantity: variant.quantity,
    }))

    // Debug the final options being passed to SearchableSelect
    debugLog(
      "Final variant options for SearchableSelect",
      options.map((o) => ({
        id: o.value,
        name: o.label,
        description: o.description,
        quantity: o._debug_quantity,
      })),
    )

    return options
  }, [availableVariants])

  // Add this useEffect to debug the rendering of options in the SearchableSelect
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && availableVariants.length > 0) {
      const negativeQuantityOptions = availableVariants.filter((v) => v.quantity !== null && v.quantity < 0)

      console.log(`SearchableSelect will render ${availableVariants.length} options, 
        including ${negativeQuantityOptions.length} with negative quantity`)

      if (negativeQuantityOptions.length > 0) {
        console.log(
          "Sample negative quantity options:",
          negativeQuantityOptions.slice(0, 3).map((v) => ({
            name: v.product_variant_name,
            quantity: v.quantity,
            id: v.id.substring(0, 8),
          })),
        )
      }
    }
  }, [availableVariants])

  // Handle variant selection with better error handling
  const handleVariantChange = (option: SearchableSelectOption | null) => {
    const variantId = option?.value || null
    setSelectedVariantId(variantId)

    if (!variantId) {
      return
    }

    // Find the selected variant
    const variant = availableVariants.find((v) => v.id === variantId)

    if (!variant && process.env.NODE_ENV === "development") {
      console.warn(`Variant with ID ${variantId} not found in availableVariants array`)
    }
  }

  // Handle category change
  const handleCategoryChange = (option: SearchableSelectOption | null) => {
    setSelectedCategory(option?.value === "all" ? null : option?.value || null)
  }

  // Get the selected product
  const selectedProduct = selectedProductId ? products.find((p) => p.id === selectedProductId) : null

  // Calculate total from pallets and layers
  const calculatePalletsFromTotal = useCallback(
    (customQuantity?: number) => {
      try {
        // Skip calculations if needed
        if (skipCalculations) {
          return { pallets, layers }
        }

        // If user is actively editing pallets or layers, don't override their input
        if (
          userEditingRef.current.isEditing &&
          (userEditingRef.current.field === "pallets" || userEditingRef.current.field === "layers")
        ) {
          return {
            pallets: userEditingRef.current.lastValues.pallets,
            layers: userEditingRef.current.lastValues.layers,
          }
        }

        if (!selectedProduct) {
          debugLog("calculatePalletsFromTotal: No selected product")
          return { pallets: 0, layers: 0 }
        }

        const feetPerLayer = selectedProduct.feet_per_layer || DEFAULT_FEET_PER_LAYER
        const layersPerPallet = selectedProduct.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

        const qtyToUse = customQuantity !== undefined ? customQuantity : quantity

        // Calculate exact layers (quantity / feet_per_layer)
        const exactLayers = qtyToUse / feetPerLayer

        // Round up to get total layers (ROUNDUP function in spreadsheet)
        const totalLayers = Math.ceil(exactLayers)

        // Calculate pallets using floor division (ROUNDDOWN in spreadsheet)
        const calculatedPallets = Math.floor(totalLayers / layersPerPallet)

        // Calculate remaining layers (total_layers - pallets * layers_per_pallet)
        const calculatedLayers = totalLayers - calculatedPallets * layersPerPallet

        if (process.env.NODE_ENV === "development") {
          debugLog("calculatePalletsFromTotal result:", {
            qtyToUse,
            feetPerLayer,
            layersPerPallet,
            exactLayers,
            totalLayers,
            calculatedPallets,
            calculatedLayers,
            isUserEditing: userEditingRef.current.isEditing,
            editingField: userEditingRef.current.field,
          })
        }

        return { pallets: calculatedPallets, layers: calculatedLayers }
      } catch (error) {
        log(LogLevel.ERROR, "PurchaseOrderItems", "Error in calculatePalletsFromTotal:", error)
        return { pallets: 0, layers: 0 }
      }
    },
    [selectedProduct, quantity, pallets, layers, skipCalculations],
  )

  const calculateTotalFromPallets = useCallback(
    (customPallets?: number, customLayers?: number) => {
      try {
        // Skip calculations if needed
        if (skipCalculations) {
          return quantity
        }

        // If user is actively editing quantity, don't override their input
        if (userEditingRef.current.isEditing && userEditingRef.current.field === "quantity") {
          return userEditingRef.current.lastValues.quantity
        }

        if (!selectedProduct) {
          debugLog("calculateTotalFromPallets: No selected product")
          return 0
        }

        const feetPerLayer = selectedProduct.feet_per_layer || DEFAULT_FEET_PER_LAYER
        const layersPerPallet = selectedProduct.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

        const palletsToUse = customPallets !== undefined ? customPallets : pallets
        const layersToUse = customLayers !== undefined ? customLayers : layers

        // Calculate total layers (pallets * layers_per_pallet + layers)
        const totalLayers = layersPerPallet * palletsToUse + layersToUse

        // Calculate quantity (total_layers * feet_per_layer)
        const result = totalLayers * feetPerLayer

        if (process.env.NODE_ENV === "development") {
          debugLog("calculateTotalFromPallets result:", {
            palletsToUse,
            layersToUse,
            feetPerLayer,
            layersPerPallet,
            totalLayers,
            result,
            isUserEditing: userEditingRef.current.isEditing,
            editingField: userEditingRef.current.field,
          })
        }

        return result
      } catch (error) {
        log(LogLevel.ERROR, "PurchaseOrderItems", "Error in calculateTotalFromPallets:", error)
        return 0
      }
    },
    [selectedProduct, pallets, layers, quantity, skipCalculations],
  )

  // Calculate the rounded quantity based on the current input
  const calculateRoundedQuantity = useCallback(() => {
    if (!selectedProduct) return 0

    const feetPerLayer = selectedProduct.feet_per_layer || DEFAULT_FEET_PER_LAYER

    // Calculate exact layers first
    const exactLayers = quantity / feetPerLayer
    // Round up to the nearest whole layer
    const totalLayers = Math.ceil(exactLayers)
    // Calculate rounded quantity
    return totalLayers * feetPerLayer
  }, [selectedProduct, quantity])

  // Handle quantity change
  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        // Mark that user is editing quantity
        userEditingRef.current = {
          isEditing: true,
          field: "quantity",
          lastValues: {
            ...userEditingRef.current.lastValues,
            quantity: e.target.value === "" ? 0 : Number(e.target.value),
          },
        }

        // Update quantity state
        let newValue = e.target.value === "" ? 0 : Number(e.target.value)

        // Round up to nearest whole number for Square Feet
        if (selectedProduct && selectedProduct.unit === "Square Feet" && newValue > 0) {
          newValue = Math.ceil(newValue)
          // Also update the last value in the ref to the rounded value
          userEditingRef.current.lastValues.quantity = newValue
        }

        setQuantity(newValue)

        // Always calculate pallets/layers if we have a special unit product
        // and we're not skipping calculations
        if (
          !skipCalculations &&
          selectedProduct &&
          (selectedProduct.unit === "Square Feet" || selectedProduct.unit === "Linear Feet")
        ) {
          const { pallets: calcPallets, layers: calcLayers } = calculatePalletsFromTotal(newValue)
          setPallets(calcPallets)
          setLayers(calcLayers)
        }

        // Reset the editing flag after a short delay
        setTimeout(() => {
          userEditingRef.current.isEditing = false
        }, 300)
      } catch (error) {
        log(LogLevel.ERROR, "PurchaseOrderItems", "Error in handleQuantityChange:", error)
      }
    },
    [selectedProduct, calculatePalletsFromTotal, skipCalculations],
  )

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedProductId || !selectedVariantId) {
      toast({
        title: "Validation Error",
        description: "Please select a product and variant",
        variant: "destructive",
      })
      return
    }

    // Ensure calculations are up-to-date before adding the item
    let finalQuantity = quantity
    let finalPallets = pallets
    let finalLayers = layers
    let isPalletBased = false

    // Find the selected product and variant
    const product = products.find((p) => p.id === selectedProductId)
    const variant = availableVariants.find((v) => v.id === selectedVariantId)

    if (!product || !variant) {
      toast({
        title: "Error",
        description: "Selected product or variant not found",
        variant: "destructive",
      })
      return
    }

    const isSpecialUnit = product.unit === "Square Feet" || product.unit === "Linear Feet"

    if (isSpecialUnit) {
      // For special units (Square Feet, Linear Feet)
      if (roundingEnabled) {
        // Use the rounded quantity when rounding is enabled
        const feetPerLayer = product.feet_per_layer || DEFAULT_FEET_PER_LAYER
        const exactLayers = quantity / feetPerLayer
        const totalLayers = Math.ceil(exactLayers)
        finalQuantity = totalLayers * feetPerLayer
      } else {
        // Use the exact quantity when rounding is disabled
        finalQuantity = quantity
      }

      // Recalculate pallets and layers from the quantity
      const { pallets: calcPallets, layers: calcLayers } = calculatePalletsFromTotal(finalQuantity)
      finalPallets = calcPallets
      finalLayers = calcLayers
      isPalletBased = true
    } else {
      // For non-special units (Each, etc.)
      finalQuantity = Math.ceil(quantity)
      // Always include pallets and layers as 0 for consistency
      finalPallets = 0
      finalLayers = 0
      isPalletBased = false
    }

    const unitPrice = variant.unit_price || 0
    const total = finalQuantity * unitPrice * (1 - discountPercentage / 100)
    const discount = unitPrice * finalQuantity * (discountPercentage / 100)

    const itemData = {
      product_id: selectedProductId,
      variant_id: selectedVariantId,
      product_name: product.product_name,
      variant_name: variant.product_variant_name,
      variant_sku: variant.product_variant_sku || "",
      unit_price: unitPrice,
      quantity: finalQuantity,
      discount_percentage: discountPercentage,
      discount: discount,
      total: finalQuantity * unitPrice,
      total_order_item_value: total,
      is_pallet: isPalletBased,
      pallets: finalPallets,
      layers: finalLayers,
      unit: product.unit,
      feet_per_layer: product.feet_per_layer,
      layers_per_pallet: product.layers_per_pallet,
    }

    if (editingItemId && itemToEdit) {
      // We're editing an existing item
      const editedItem: OrderItem = {
        ...itemData,
        purchase_order_item_id: editingItemId,
      }

      if (process.env.NODE_ENV === "development") {
        debugLog("Updating order item", {
          id: editingItemId,
          product: editedItem.product_name,
          variant: editedItem.variant_name,
          quantity: editedItem.quantity,
          pallets: editedItem.pallets,
          layers: editedItem.layers,
          is_pallet: editedItem.is_pallet,
        })
      }

      onItemEdited(editedItem)
      toast({
        title: "Item Updated",
        description: "The order item has been updated successfully.",
      })
    } else {
      // We're adding a new item
      const newItem: OrderItem = {
        ...itemData,
        purchase_order_item_id: `new-${uuidv4()}`,
      }

      if (process.env.NODE_ENV === "development") {
        debugLog("Adding order item", {
          product: newItem.product_name,
          variant: newItem.variant_name,
          quantity: newItem.quantity,
        })
      }

      onAddItem(newItem)
      toast({
        title: "Item Added",
        description: "The item has been added to the order.",
      })
    }

    // Reset form
    formInitializedRef.current = false
    setSelectedProductId(null)
    setSelectedVariantId(null)
    setAvailableVariants([])
    setQuantity(0)
    setPallets(0)
    setLayers(0)
    setDiscountPercentage(0)
    userEditingRef.current = {
      isEditing: false,
      field: null,
      lastValues: {
        quantity: 0,
        pallets: 0,
        layers: 0,
      },
    }
  }

  // Get the unit display
  const getUnitDisplay = () => {
    if (!selectedProduct) return "Unit"
    return selectedProduct.unit || "Unit"
  }

  // Determine if the Add Item button should be enabled
  const isAddItemEnabled = useCallback(() => {
    if (!selectedProduct || !selectedVariantId) return false
    return quantity > 0
  }, [selectedProduct, selectedVariantId, quantity])

  // Add this useEffect for debugging state changes
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && editingItemId) {
      debugLog("Form state updated during editing:", {
        quantity,
        pallets,
        layers,
        skipCalculations,
        userEditingRef: {
          isEditing: userEditingRef.current.isEditing,
          field: userEditingRef.current.field,
          lastValues: userEditingRef.current.lastValues,
        },
      })
    }
  }, [editingItemId, quantity, pallets, layers, skipCalculations])

  const calculateItemTotal = () => {
    const unitPrice = availableVariants.find((v) => v.id === selectedVariantId)?.unit_price || 0
    return quantity * unitPrice * (1 - discountPercentage / 100)
  }

  // Improved rendering of product options with conditional field display
  return (
    <div className="space-y-4 p-4 border rounded-md bg-gray-50">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{editingItemId ? "Edit Order Item" : "Add Order Item"}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Debug information - always show in development */}
      {process.env.NODE_ENV === "development" && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <div>Products available: {filteredProducts.length}</div>
          <div>Selected Product: {selectedProductId || "None"}</div>
          <div>Available Variants: {availableVariants.length}</div>
          <div>Selected Variant: {selectedVariantId || "None"}</div>
          <div>Skip Calculations: {skipCalculations ? "Yes" : "No"}</div>
          <div>User Editing: {userEditingRef.current.isEditing ? `Yes (${userEditingRef.current.field})` : "No"}</div>
          <div>Form Initialized: {formInitializedRef.current ? "Yes" : "No"}</div>
        </div>
      )}

      {/* Product Category - Now using SearchableSelect */}
      <div className="space-y-2">
        <Label htmlFor="category">Product Category</Label>
        <SearchableSelect
          id="category"
          value={
            selectedCategory
              ? { value: selectedCategory, label: selectedCategory || "Uncategorized" }
              : { value: "all", label: "All Categories" }
          }
          onChange={handleCategoryChange}
          options={categoryOptions}
          placeholder="Search categories..."
          isClearable
        />
      </div>

      {/* Product Selection - Now using SearchableSelect */}
      <div className="space-y-2">
        <Label htmlFor="product">Product *</Label>
        <SearchableSelect
          id="product"
          value={
            selectedProductId
              ? {
                  value: selectedProductId,
                  label: products.find((p) => p.id === selectedProductId)?.product_name || "Unknown Product",
                }
              : null
          }
          onChange={handleProductChange}
          options={productOptions}
          placeholder="Search products..."
          isClearable
          formatOptionLabel={(option) => (
            <div className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </div>
          )}
          noOptionsMessage={() => "No products found"}
        />
        {filteredProducts.length === 0 && (
          <p className="text-sm text-amber-600">No products available for the selected manufacturer and category.</p>
        )}
      </div>

      {/* Only show Variant selection if a product is selected */}
      {selectedProductId && (
        <div className="space-y-2">
          <Label htmlFor="variant">Variant *</Label>
          {process.env.NODE_ENV === "development" && (
            <div className="p-2 mb-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <div>Available Variants: {availableVariants.length}</div>
              <div>Variant Options: {variantOptions.length}</div>
              <div>Selected Variant: {selectedVariantId || "None"}</div>
              <div>
                Negative Quantity Variants:{" "}
                {availableVariants.filter((v) => v.quantity !== null && v.quantity < 0).length}
              </div>
            </div>
          )}
          <SearchableSelect
            id="variant"
            value={
              selectedVariantId
                ? {
                    value: selectedVariantId,
                    label:
                      availableVariants.find((v) => v.id === selectedVariantId)?.product_variant_name ||
                      "Unknown Variant",
                  }
                : null
            }
            onChange={(option) => {
              handleVariantChange(option)
              // Debug the selected option
              if (process.env.NODE_ENV === "development") {
                debugLog(
                  "Variant selected",
                  option
                    ? {
                        id: option.value,
                        label: option.label,
                        variant: availableVariants.find((v) => v.id === option.value),
                      }
                    : "None",
                )
              }
            }}
            options={variantOptions}
            placeholder="Search variants..."
            isDisabled={!selectedProductId || availableVariants.length === 0}
            isClearable
            formatOptionLabel={(option) => {
              // Find the variant to get its quantity
              const variant = availableVariants.find((v) => v.id === option.value)
              const quantity = variant?.quantity !== null ? variant?.quantity : "N/A"
              const quantityClass =
                variant?.quantity !== null && variant.quantity < 0
                  ? "text-red-600 font-bold" // Make negative quantities more visible
                  : "text-emerald-600"

              // Debug each option as it's being rendered
              if (process.env.NODE_ENV === "development" && variant) {
                console.log(`Rendering option: ${option.label}, ID: ${option.value}, Quantity: ${quantity}`)
              }

              return (
                <div className="flex flex-col">
                  <div className="flex justify-between items-center w-full">
                    <span className="font-medium">{option.label}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${quantityClass} bg-opacity-20 ${quantityClass.replace("text", "bg")}`}
                    >
                      Stock: {quantity}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">SKU: {option.description}</span>
                </div>
              )
            }}
            noOptionsMessage={() =>
              selectedProductId ? "No variants available for this product" : "Select a product first"
            }
          />
          {selectedProductId && availableVariants.length === 0 && (
            <p className="text-sm text-amber-600">This product has no variants. Please select a different product.</p>
          )}
        </div>
      )}

      {/* Only show the remaining fields if both product and variant are selected */}
      {selectedProductId && selectedVariantId && (
        <>
          {/* Quantity and Unit Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity ({getUnitDisplay()}) *</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step={selectedProduct?.unit === "Square Feet" ? "1" : "any"}
                value={quantity}
                onChange={handleQuantityChange}
              />
              {selectedProduct &&
                (selectedProduct.unit === "Square Feet" || selectedProduct.unit === "Linear Feet") &&
                quantity > 0 && (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {roundingEnabled ? (
                        <>
                          Rounded to the nearest layer: {calculateRoundedQuantity()} {selectedProduct.unit}
                          <br />({pallets} pallets, {layers} layers)
                        </>
                      ) : (
                        <>
                          {quantity} {selectedProduct.unit}
                          <br />({pallets} pallets, {layers} layers)
                        </>
                      )}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">Round quantity</span>
                      <div
                        className={`relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${roundingEnabled ? "bg-primary" : "bg-gray-200"}`}
                        onClick={() => setRoundingEnabled(!roundingEnabled)}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${roundingEnabled ? "translate-x-4" : "translate-x-0"}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount">Discount (%)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                max="100"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span>Unit Price:</span>
              <span>{formatCurrency(availableVariants.find((v) => v.id === selectedVariantId)?.unit_price || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Quantity:</span>
              <span>
                {selectedProduct && isSpecialUnit(selectedProduct.unit) && roundingEnabled
                  ? calculateRoundedQuantity()
                  : quantity}{" "}
                {selectedProduct?.unit || ""}
              </span>
            </div>
            {discountPercentage > 0 && (
              <div className="flex justify-between">
                <span>Discount ({discountPercentage}%):</span>
                <span>
                  {formatCurrency(
                    (availableVariants.find((v) => v.id === selectedVariantId)?.unit_price || 0) *
                      quantity *
                      (discountPercentage / 100),
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>{formatCurrency(calculateItemTotal())}</span>
            </div>
          </div>
        </>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!isAddItemEnabled()}>
          {editingItemId ? "Update Item" : "Add Item"}
        </Button>
      </div>
    </div>
  )
}

export function PurchaseOrderItems({
  products,
  orderItems,
  setOrderItems,
  deletedOrderItems,
  setDeletedOrderItems,
  transientItemIds,
  setTransientItemIds,
  hasManuallyModifiedItems,
  setHasManuallyModifiedItems,
  selectedManufacturerId,
  onItemRemoved,
  showAddItemForm,
  setShowAddItemForm,
  productVariants,
}: PurchaseOrderItemsProps) {
  // Use internal state if external state is not provided
  const [internalShowAddItemForm, setInternalShowAddItemForm] = useState(false)

  // Use either the external or internal state
  const showAddItemFormInternal = showAddItemForm !== undefined ? showAddItemForm : internalShowAddItemForm
  const setShowAddItemFormInternal = setShowAddItemForm || setInternalShowAddItemForm

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState<number>(0)
  const [pallets, setPallets] = useState<number>(0)
  const [layers, setLayers] = useState<number>(0)
  const [discountPercentage, setDiscountPercentage] = useState<number>(0)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Add this state at the top of the PurchaseOrderItems component
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false)

  // Remove debug state
  // Confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<OrderItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Ref to store deleted item IDs
  const deletedItemIdsRef = useRef(new Set<string>())

  // Add this ref at the top of the component
  const prevItemsRef = useRef<any[]>([])

  // Add the toast hook declaration inside the component
  const { toast } = useToast()

  // Check if a manufacturer is selected
  const hasManufacturerSelected = !!selectedManufacturerId && selectedManufacturerId.trim() !== ""

  // Add comprehensive logging on component mount to verify product data
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      try {
        debugLog("PurchaseOrderItems component mounted", {
          productsCount: products?.length || 0,
          variantsCount: productVariants?.length || 0,
          selectedManufacturerId,
        })

        // Debug all product variants received in the main component
        debugVariants("Initial productVariants in PurchaseOrderItems", productVariants)

        // Check for variants with negative quantities
        const negativeQuantityVariants = productVariants.filter((v) => v.quantity !== null && v.quantity < 0)
        if (negativeQuantityVariants.length > 0) {
          debugLog("Found variants with negative quantities", negativeQuantityVariants)
        }

        // Add this to debug manufacturer-specific variants
        if (selectedManufacturerId) {
          const manufacturerProducts = products.filter((p) => p.manufacturer_id === selectedManufacturerId)
          const manufacturerProductIds = manufacturerProducts.map((p) => p.id)
          const manufacturerVariants = productVariants.filter((v) => manufacturerProductIds.includes(v.product_id))

          console.log(`Manufacturer ${selectedManufacturerId} has:
            - ${manufacturerProducts.length} products
            - ${manufacturerVariants.length} variants
            - ${manufacturerVariants.filter((v) => v.quantity !== null && v.quantity < 0).length} variants with negative quantity`)

          // Log some examples of negative quantity variants for this manufacturer
          const negativeQuantityManufacturerVariants = manufacturerVariants.filter(
            (v) => v.quantity !== null && v.quantity < 0,
          )

          if (negativeQuantityManufacturerVariants.length > 0) {
            console.log(
              "Sample negative quantity variants for this manufacturer:",
              negativeQuantityManufacturerVariants.slice(0, 3).map((v) => ({
                name: v.product_variant_name,
                quantity: v.quantity,
                id: v.id.substring(0, 8),
              })),
            )
          }
        }
      } catch (error) {
        debugLog("Error in product data verification:", error)
      }
    }
  }, [products, productVariants, selectedManufacturerId])

  // Filter products by manufacturer if a manufacturer ID is provided
  const filteredProducts = useMemo(() => {
    try {
      if (!selectedManufacturerId) return products
      const filtered = products.filter((product) => product.manufacturer_id === selectedManufacturerId)

      if (process.env.NODE_ENV === "development") {
        debugLog(`Filtered products by manufacturer`, {
          total: filtered.length,
          withUnits: filtered.filter((p) => p.unit).length,
        })
      }

      return filtered
    } catch (error) {
      log(LogLevel.ERROR, "PurchaseOrderItems", "Error filtering products by manufacturer:", error)
      toast({
        variant: "destructive",
        title: "Error filtering products",
        description: error instanceof Error ? error.message : String(error),
      })
      return products
    }
  }, [products, selectedManufacturerId, toast])

  // Get unique categories for the selected manufacturer
  const categoriesByManufacturer = useMemo(() => {
    try {
      const categories = new Set<string>()
      filteredProducts.forEach((product) => {
        if (product.product_category) {
          categories.add(product.product_category)
        }
      })
      return Array.from(categories).sort()
    } catch (error) {
      log(LogLevel.ERROR, "PurchaseOrderItems", "Error getting categories by manufacturer:", error)
      return []
    }
  }, [filteredProducts])

  // Filter products by category
  const filteredByCategory = useMemo(() => {
    try {
      if (!selectedCategory) return filteredProducts
      const filtered = filteredProducts.filter((product) => product.product_category === selectedCategory)

      if (process.env.NODE_ENV === "development") {
        debugLog(`Filtered products by category`, {
          category: selectedCategory,
          count: filtered.length,
        })
      }

      return filtered
    } catch (error) {
      log(LogLevel.ERROR, "PurchaseOrderItems", "Error filtering products by category:", error)
      return filteredProducts
    }
  }, [filteredProducts, selectedCategory])

  // Convert data to options for SearchableSelect
  const categoryOptions = useMemo<SearchableSelectOption[]>(() => {
    try {
      const options = [{ value: "all", label: "All Categories" }]
      categoriesByManufacturer.forEach((category) => {
        options.push({
          value: category || "uncategorized",
          label: category || "Uncategorized",
        })
      })
      return options
    } catch (error) {
      log(LogLevel.ERROR, "PurchaseOrderItems", "Error creating category options:", error)
      return [{ value: "all", label: "All Categories" }]
    }
  }, [categoriesByManufacturer])

  const productOptions = useMemo<SearchableSelectOption[]>(() => {
    try {
      return filteredByCategory.map((product) => ({
        value: product.id,
        label: product.product_name,
      }))
    } catch (error) {
      log(LogLevel.ERROR, "PurchaseOrderItems", "Error creating product options:", error)
      return []
    }
  }, [filteredByCategory])

  const variantOptions = useMemo<SearchableSelectOption[]>(() => {
    try {
      if (!selectedProduct) return []
      return selectedProduct.product_variants.map((variant) => ({
        value: variant.id,
        label: `${variant.product_variant_name} (${variant.product_variant_sku})`,
      }))
    } catch (error) {
      log(LogLevel.ERROR, "PurchaseOrderItems", "Error creating variant options:", error)
      return []
    }
  }, [selectedProduct])

  // Update the calculateTotalFromPallets function to handle null values better
  const calculateTotalFromPallets = useCallback(
    (customPallets?: number, customLayers?: number) => {
      try {
        if (!selectedProduct) {
          debugLog("calculateTotalFromPallets: No selected product")
          return 0
        }

        const feetPerLayer = selectedProduct.feet_per_layer || DEFAULT_FEET_PER_LAYER
        const layersPerPallet = selectedProduct.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

        const palletsToUse = customPallets !== undefined ? customPallets : pallets
        const layersToUse = customLayers !== undefined ? customLayers : layers

        const fullPalletLayers = layersPerPallet * palletsToUse
        const totalLayers = fullPalletLayers + layersToUse
        const result = totalLayers * feetPerLayer

        debugLog("calculateTotalFromPallets result:", {
          palletsToUse,
          layersToUse,
          feetPerLayer,
          layersPerPallet,
          fullPalletLayers,
          totalLayers,
          result,
        })

        return result
      } catch (error) {
        log(LogLevel.ERROR, "PurchaseOrderItems", "Error in calculateTotalFromPallets:", error)
        return 0
      }
    },
    [selectedProduct, pallets, layers],
  )

  // Update the calculatePalletsFromTotal function to handle null values better
  const calculatePalletsFromTotal = useCallback(
    (customQuantity?: number) => {
      try {
        if (!selectedProduct) {
          debugLog("calculatePalletsFromTotal: No selected product")
          return { pallets: 0, layers: 0 }
        }

        const feetPerLayer = selectedProduct.feet_per_layer || DEFAULT_FEET_PER_LAYER
        const layersPerPallet = selectedProduct.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

        const qtyToUse = customQuantity !== undefined ? customQuantity : quantity
        const totalLayers = Math.ceil(qtyToUse / feetPerLayer)
        const calculatedPallets = Math.floor(totalLayers / layersPerPallet)
        const calculatedLayers = totalLayers % layersPerPallet

        const result = { pallets: calculatedPallets, layers: calculatedLayers }

        debugLog("calculatePalletsFromTotal result:", {
          qtyToUse,
          feetPerLayer,
          layersPerPallet,
          totalLayers,
          calculatedPallets,
          calculatedLayers,
        })

        return result
      } catch (error) {
        log(LogLevel.ERROR, "PurchaseOrderItems", "Error in calculatePalletsFromTotal:", error)
        return { pallets: 0, layers: 0 }
      }
    },
    [selectedProduct, quantity],
  )

  const handleAddNewItem = useCallback(() => {
    // Check if a manufacturer is selected
    if (!hasManufacturerSelected) {
      toast({
        variant: "destructive",
        title: "Manufacturer Required",
        description: "Please select a manufacturer before adding items to the order.",
      })
      return
    }

    setShowAddItemFormInternal(true)
  }, [hasManufacturerSelected, toast, setShowAddItemFormInternal])

  const handleCancelForm = useCallback(() => {
    setShowAddItemFormInternal(false)
    setEditingItemId(null)
  }, [setShowAddItemFormInternal])

  const handleAddItemInternal = useCallback(
    (newItem: OrderItem) => {
      setOrderItems((prev) => [...prev, newItem])
      setShowAddItemFormInternal(false)
    },
    [setOrderItems, setShowAddItemFormInternal],
  )

  const handleEditItem = useCallback(
    (item: OrderItem) => {
      // Set the item being edited
      setEditingItemId(item.purchase_order_item_id)

      // Find the product and variant
      const product = products.find((p) => p.id === item.product_id)

      if (!product) {
        toast({
          title: "Error",
          description: "Product not found. Please try again.",
          variant: "destructive",
        })
        return
      }

      // Show the add item form
      setShowAddItemFormInternal(true)

      // We'll pass the item to edit to the AddItemForm component
      // The rest of the logic will be handled there
    },
    [products, toast, setShowAddItemFormInternal],
  )

  const showDeleteConfirmation = useCallback((item: OrderItem) => {
    setItemToDelete(item)
    setIsDeleteDialogOpen(true)
  }, [])

  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false)
    setItemToDelete(null)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!itemToDelete) return

    setIsDeleting(true)

    // Simulate deletion process
    setTimeout(() => {
      // Remove the item from the orderItems array
      setOrderItems((prevItems) =>
        prevItems.filter((i) => i.purchase_order_item_id !== itemToDelete.purchase_order_item_id),
      )

      // Add the item to the deletedOrderItems array
      setDeletedOrderItems((prevDeletedItems) => [...prevDeletedItems, itemToDelete])

      // If the item has a purchase_order_item_id, add it to the deletedItemIdsRef
      if (itemToDelete.purchase_order_item_id && !itemToDelete.isTransient) {
        deletedItemIdsRef.current.add(itemToDelete.purchase_order_item_id)
      }

      // Remove the transient item ID from the set
      if (itemToDelete.isTransient && itemToDelete.purchase_order_item_id) {
        setTransientItemIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(itemToDelete.purchase_order_item_id)
          return newSet
        })
      }

      // Close the dialog and reset state
      setIsDeleteDialogOpen(false)
      setItemToDelete(null)
      setIsDeleting(false)

      // Optionally, show a toast notification
      toast({
        title: "Item Removed",
        description: `${itemToDelete.product_name} has been removed from the order.`,
      })

      // Call the onItemRemoved callback
      onItemRemoved(itemToDelete)
    }, 500)
  }, [
    itemToDelete,
    setOrderItems,
    setDeletedOrderItems,
    setTransientItemIds,
    toast,
    onItemRemoved,
    setIsDeleteDialogOpen,
  ])

  const handleUpdateItem = useCallback(
    (updatedItem: OrderItem) => {
      setIsProcessingUpdate(true)

      // Simulate update process
      setTimeout(() => {
        // Update the item in the orderItems array
        setOrderItems((prevItems) =>
          prevItems.map((item) =>
            item.purchase_order_item_id === updatedItem.purchase_order_item_id ? updatedItem : item,
          ),
        )

        // Close the form and reset state
        setShowAddItemFormInternal(false)
        setEditingItemId(null)
        setIsProcessingUpdate(false)

        // Optionally, show a toast notification
        toast({
          title: "Item Updated",
          description: `${updatedItem.product_name} has been updated in the order.`,
        })
      }, 500)
    },
    [setOrderItems, setShowAddItemFormInternal, toast],
  )

  // Helper function to check if a unit is a special unit (Square Feet or Linear Feet)
  const isSpecialUnit = useCallback((unit: string | null): boolean => {
    return unit === "Square Feet" || unit === "Linear Feet"
  }, [])

  // Calculate the rounded quantity for display in the table
  const calculateRoundedQuantity = useCallback(
    (item: OrderItem): number => {
      if (!item.unit || !isSpecialUnit(item.unit) || !item.feet_per_layer) return item.quantity

      const feetPerLayer = item.feet_per_layer || DEFAULT_FEET_PER_LAYER

      // Calculate exact layers first
      const exactLayers = item.quantity / feetPerLayer
      // Round up to the nearest whole layer
      const totalLayers = Math.ceil(exactLayers)
      // Calculate rounded quantity
      return totalLayers * feetPerLayer
    },
    [isSpecialUnit],
  )

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>Add products to this order</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!showAddItemFormInternal && (
              <Button onClick={handleAddNewItem} type="button" disabled={!hasManufacturerSelected}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Item
                {!hasManufacturerSelected && <span className="sr-only">(Select a manufacturer first)</span>}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasManufacturerSelected && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">
                  Please select a manufacturer in the Order Details tab before adding items to the order.
                </p>
              </div>
            </div>
          )}

          {/* Inside the CardContent, before rendering AddItemForm */}
          {showAddItemFormInternal && (
            <AddItemForm
              products={products}
              productVariants={productVariants}
              onAddItem={handleAddItemInternal}
              onCancel={handleCancelForm}
              selectedManufacturerId={selectedManufacturerId}
              editingItemId={editingItemId}
              itemToEdit={orderItems.find((item) => item.purchase_order_item_id === editingItemId) || null}
              onItemEdited={handleUpdateItem}
            />
          )}

          {orderItems.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No items added yet. Click "Add Item" to add products to this order.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map((item) => {
                  // Find the product to get its unit
                  const product = products.find((p) => p.id === item.product_id)

                  // Use product.unit as the source of truth, fallback to item.unit, then default
                  const productUnit = product?.unit || item.unit || DEFAULT_UNIT

                  return (
                    <TableRow key={item.purchase_order_item_id}>
                      <TableCell className="font-medium">
                        {item.product_name}
                        {isSpecialUnit(productUnit) && item.feet_per_layer && item.layers_per_pallet && (
                          <span className="text-xs text-muted-foreground block">
                            ({item.feet_per_layer} ft/layer, {item.layers_per_pallet} layers/pallet)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{item.variant_name}</TableCell>
                      <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell>
                        {item.quantity.toFixed(0)} {productUnit}
                        {isSpecialUnit(productUnit) && (
                          <span className="text-xs text-muted-foreground block">
                            ({item.pallets} pallets, {item.layers} layers)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.discount_percentage > 0 ? (
                          <>
                            {item.discount_percentage}%
                            <span className="text-xs text-muted-foreground block">
                              ({formatCurrency(item.discount)})
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(item.total_order_item_value)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault() // Prevent any form submission
                              handleEditItem(item)
                            }}
                            type="button" // Explicitly set type to button
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault() // Prevent any form submission
                              showDeleteConfirmation(item)
                            }}
                            type="button" // Explicitly set type to button
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>Are you sure you want to remove this item from the order?</DialogDescription>
          </DialogHeader>

          {itemToDelete && (
            <div className="py-4">
              <div className="rounded-md bg-muted p-4">
                <p className="font-medium">{itemToDelete.product_name}</p>
                <p className="text-sm text-muted-foreground">{itemToDelete.variant_name}</p>
                <div className="mt-2 flex justify-between text-sm">
                  <span>Quantity:</span>
                  <span>
                    {itemToDelete.quantity}{" "}
                    {products.find((p) => p.id === itemToDelete.product_id)?.unit || itemToDelete.unit || DEFAULT_UNIT}
                    {isSpecialUnit(itemToDelete.unit) &&
                      ` (${itemToDelete.pallets} pallets, ${itemToDelete.layers} layers)`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total:</span>
                  <span className="font-medium">{formatCurrency(itemToDelete.total_order_item_value)}</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                This will update inventory levels to reflect the item's removal.
              </p>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={handleCancelDelete} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting} className="gap-2">
              {isDeleting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Removing...
                </>
              ) : (
                "Remove Item"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
