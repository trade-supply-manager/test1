"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { PlusCircle, Trash2, Edit, X, AlertCircle } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { getSupabaseClient } from "@/lib/supabase-client"
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
}

interface CustomerOrderItemsProps {
  products: Product[]
  orderItems: OrderItem[]
  setOrderItems: React.Dispatch<React.SetStateAction<OrderItem[]>>
  onItemRemoved?: (item: OrderItem) => void
}

// Default conversion rates
const DEFAULT_FEET_PER_LAYER = 100
const DEFAULT_LAYERS_PER_PALLET = 10

export function CustomerOrderItems({ products, orderItems, setOrderItems, onItemRemoved }: CustomerOrderItemsProps) {
  const [showAddItemForm, setShowAddItemForm] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState<number>(0)
  const [pallets, setPallets] = useState<number>(0)
  const [layers, setLayers] = useState<number>(0)
  const [discountPercentage, setDiscountPercentage] = useState<number>(0)
  const [roundQuantity, setRoundQuantity] = useState<boolean>(true) // Default to ON
  // Always use exact input mode, but still calculate pallets and layers
  const inputMethod = "exact"
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Manufacturer and category filter states
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Track removed items to prevent re-addition
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set())

  // Confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<OrderItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Effect to synchronize calculations when dependencies change
  useEffect(() => {
    if (selectedProduct && (selectedProduct.unit === "Square Feet" || selectedProduct.unit === "Linear Feet")) {
      if (inputMethod === "exact" && quantity > 0) {
        // Calculate pallets and layers from quantity
        const { pallets: calcPallets, layers: calcLayers } = calculatePalletsFromTotal()
        setPallets(calcPallets)
        setLayers(calcLayers)
      } else if (inputMethod === "pallets" && (pallets > 0 || layers > 0)) {
        // Calculate quantity from pallets and layers
        const newQuantity = calculateTotalFromPallets()
        setQuantity(newQuantity)
      }
    }
  }, [selectedProduct, inputMethod, selectedVariant])

  // Fetch manufacturers when component mounts
  const fetchManufacturers = useCallback(async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("manufacturers")
        .select("id, manufacturer_name")
        .eq("is_archived", false)
        .order("manufacturer_name", { ascending: true })

      if (error) throw error
      setManufacturers(data || [])
    } catch (error) {
      console.error("Error fetching manufacturers:", error)
    }
  }, [])

  useEffect(() => {
    fetchManufacturers()
  }, [fetchManufacturers])

  // Filter products by manufacturer
  const productsByManufacturer = useMemo(() => {
    if (!selectedManufacturerId) return products
    return products.filter((product) => product.manufacturer_id === selectedManufacturerId)
  }, [products, selectedManufacturerId])

  // Get unique categories for the selected manufacturer
  const categoriesByManufacturer = useMemo(() => {
    const categories = new Set<string>()
    productsByManufacturer.forEach((product) => {
      if (product.product_category) {
        categories.add(product.product_category)
      }
    })
    return Array.from(categories).sort()
  }, [productsByManufacturer])

  // Filter products by category
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return productsByManufacturer
    return productsByManufacturer.filter((product) => product.product_category === selectedCategory)
  }, [productsByManufacturer, selectedCategory])

  // Convert data to options for SearchableSelect
  const manufacturerOptions = useMemo<SearchableSelectOption[]>(() => {
    const options = [{ value: "all", label: "All Manufacturers" }]
    manufacturers.forEach((manufacturer) => {
      options.push({
        value: manufacturer.id,
        label: manufacturer.manufacturer_name,
      })
    })
    return options
  }, [manufacturers])

  const categoryOptions = useMemo<SearchableSelectOption[]>(() => {
    const options = [{ value: "all", label: "All Categories" }]
    categoriesByManufacturer.forEach((category) => {
      options.push({
        value: category,
        label: category,
      })
    })
    return options
  }, [categoriesByManufacturer])

  const productOptions = useMemo<SearchableSelectOption[]>(() => {
    return filteredProducts.map((product) => ({
      value: product.id,
      label: product.product_name,
    }))
  }, [filteredProducts])

  const variantOptions = useMemo<SearchableSelectOption[]>(() => {
    if (!selectedProduct) return []
    return selectedProduct.product_variants.map((variant) => ({
      value: variant.id,
      label: variant.product_variant_name,
      // Add these custom properties to use in the formatOptionLabel function
      customData: {
        sku: variant.product_variant_sku,
        quantity: variant.quantity || 0,
      },
    }))
  }, [selectedProduct])

  // Use useCallback to memoize these functions
  const handleAddNewItem = useCallback(() => {
    // Reset form state for a new item
    setSelectedProduct(null)
    setSelectedVariant(null)
    setQuantity(0)
    setPallets(0)
    setLayers(0)
    setDiscountPercentage(0)
    setEditingItemId(null)
    setSelectedManufacturerId(null)
    setSelectedCategory(null)
    setShowAddItemForm(true)
  }, [])

  const handleEditItem = useCallback(
    (item: OrderItem) => {
      // Editing existing item
      const product = products.find((p) => p.id === item.product_id) || null
      const variant = product?.product_variants.find((v) => v.id === item.variant_id) || null

      // Find the manufacturer ID and category for the selected product
      if (product) {
        setSelectedManufacturerId(product.manufacturer_id)
        setSelectedCategory(product.product_category)
      } else {
        setSelectedManufacturerId(null)
        setSelectedCategory(null)
      }

      setSelectedProduct(product)
      setSelectedVariant(variant)
      setQuantity(item.quantity)
      setPallets(item.pallets || 0)
      setLayers(item.layers || 0)
      setDiscountPercentage(item.discount_percentage)
      setEditingItemId(item.id)
      setShowAddItemForm(true)
    },
    [products],
  )

  const handleCancelForm = useCallback(() => {
    setShowAddItemForm(false)
  }, [])

  const handleManufacturerChange = useCallback((option: SearchableSelectOption | null) => {
    setSelectedManufacturerId(option?.value === "all" ? null : option?.value || null)
    setSelectedCategory(null) // Reset category when manufacturer changes
    setSelectedProduct(null) // Reset product when manufacturer changes
    setSelectedVariant(null) // Reset variant when manufacturer changes
  }, [])

  const handleCategoryChange = useCallback((option: SearchableSelectOption | null) => {
    setSelectedCategory(option?.value === "all" ? null : option?.value || null)
    setSelectedProduct(null) // Reset product when category changes
    setSelectedVariant(null) // Reset variant when category changes
  }, [])

  const handleProductChange = useCallback(
    (option: SearchableSelectOption | null) => {
      const product = option?.value ? products.find((p) => p.id === option.value) || null : null
      setSelectedProduct(product)
      setSelectedVariant(null)

      // Reset quantity fields to 0
      setQuantity(0)
      setPallets(0)
      setLayers(0)

      // Always set input method to "exact" as default
    },
    [products],
  )

  const handleVariantChange = useCallback(
    (option: SearchableSelectOption | null) => {
      if (!selectedProduct || !option?.value) {
        setSelectedVariant(null)
        return
      }

      const variant = selectedProduct.product_variants.find((v) => v.id === option.value) || null
      setSelectedVariant(variant)

      // Always initialize with 0 instead of inheriting from variant
      setQuantity(0)
      setPallets(0)
      setLayers(0)
    },
    [selectedProduct],
  )

  const calculateTotalFromPallets = useCallback(
    (customPallets?: number, customLayers?: number) => {
      if (!selectedProduct) return 0

      const feetPerLayer = selectedProduct.feet_per_layer || DEFAULT_FEET_PER_LAYER
      const layersPerPallet = selectedProduct.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

      const palletsToUse = customPallets !== undefined ? customPallets : pallets
      const layersToUse = customLayers !== undefined ? customLayers : layers

      // Calculate total layers
      const totalLayers = layersPerPallet * palletsToUse + layersToUse
      // Calculate quantity based on total layers
      return totalLayers * feetPerLayer
    },
    [selectedProduct, pallets, layers],
  )

  const calculatePalletsFromTotal = useCallback(
    (customQuantity?: number) => {
      if (!selectedProduct) return { pallets: 0, layers: 0 }

      const feetPerLayer = selectedProduct.feet_per_layer || DEFAULT_FEET_PER_LAYER
      const layersPerPallet = selectedProduct.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

      const qtyToUse = customQuantity !== undefined ? customQuantity : quantity

      // Calculate exact layers first
      const exactLayers = qtyToUse / feetPerLayer
      // Round up to the nearest whole layer
      const totalLayers = Math.ceil(exactLayers)
      // Calculate pallets using floor division
      const calculatedPallets = Math.floor(totalLayers / layersPerPallet)
      // Calculate remaining layers
      const calculatedLayers = totalLayers - calculatedPallets * layersPerPallet

      return { pallets: calculatedPallets, layers: calculatedLayers }
    },
    [selectedProduct, quantity],
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

  const handleQuantityChange = useCallback(
    (value: number) => {
      // Enforce integer values by using parseInt
      const intValue = Number.parseInt(value.toString(), 10) || 0
      setQuantity(intValue)

      if (selectedProduct && (selectedProduct.unit === "Square Feet" || selectedProduct.unit === "Linear Feet")) {
        // Calculate pallets and layers based on the input quantity
        const { pallets: calcPallets, layers: calcLayers } = calculatePalletsFromTotal(intValue)
        setPallets(calcPallets)
        setLayers(calcLayers)
      }
    },
    [selectedProduct, calculatePalletsFromTotal],
  )

  const handlePalletsChange = useCallback(
    (value: number) => {
      setPallets(value)
      if (inputMethod === "pallets") {
        const newQuantity = calculateTotalFromPallets(value, layers)
        setQuantity(newQuantity)
      }
    },
    [inputMethod, layers, calculateTotalFromPallets],
  )

  const handleLayersChange = useCallback(
    (value: number) => {
      setLayers(value)
      if (inputMethod === "pallets") {
        const newQuantity = calculateTotalFromPallets(pallets, value)
        setQuantity(newQuantity)
      }
    },
    [inputMethod, pallets, calculateTotalFromPallets],
  )

  const calculateItemTotal = useCallback(() => {
    if (!selectedVariant || !selectedVariant.unit_price) return 0

    const qtyToUse = roundQuantity && isSpecialUnit(selectedProduct?.unit) ? calculateRoundedQuantity() : quantity
    const baseTotal = qtyToUse * selectedVariant.unit_price
    const discount = baseTotal * (discountPercentage / 100)
    return baseTotal - discount
  }, [quantity, selectedVariant, discountPercentage, roundQuantity, selectedProduct, calculateRoundedQuantity])

  const handleAddItem = useCallback(() => {
    if (!selectedProduct || !selectedVariant) return

    // Ensure calculations are up-to-date before adding the item
    let finalQuantity = quantity
    let finalPallets = pallets
    let finalLayers = layers
    let isPalletBased = false

    // Determine if this is a pallet-based product
    const isSpecialUnit = selectedProduct.unit === "Square Feet" || selectedProduct.unit === "Linear Feet"

    if (isSpecialUnit) {
      // For special units (Square Feet, Linear Feet)
      // Calculate exact layers
      const feetPerLayer = selectedProduct.feet_per_layer || DEFAULT_FEET_PER_LAYER
      const layersPerPallet = selectedProduct.layers_per_pallet || DEFAULT_LAYERS_PER_PALLET

      if (roundQuantity) {
        // Calculate exact layers
        const exactLayers = quantity / feetPerLayer
        // Round up to the nearest whole layer
        const totalLayers = Math.ceil(exactLayers)
        // Recalculate quantity based on rounded layers to ensure consistency
        finalQuantity = totalLayers * feetPerLayer
      } else {
        // Use exact quantity entered by user
        finalQuantity = quantity
      }

      // Calculate pallets and layers
      const { pallets: calcPallets, layers: calcLayers } = calculatePalletsFromTotal(finalQuantity)
      finalPallets = calcPallets
      finalLayers = calcLayers
      isPalletBased = false
    } else {
      // For non-special units (Each, etc.)
      finalQuantity = Math.ceil(quantity)
      // Always include pallets and layers as 0 for consistency
      finalPallets = 0
      finalLayers = 0
      isPalletBased = false
    }

    const total = finalQuantity * (selectedVariant.unit_price || 0) * (1 - discountPercentage / 100)
    const discount = (selectedVariant.unit_price || 0) * finalQuantity * (discountPercentage / 100)

    const newItem: OrderItem = {
      id: editingItemId || `new-${uuidv4()}`,
      product_id: selectedProduct.id,
      variant_id: selectedVariant.id,
      product_name: selectedProduct.product_name,
      variant_name: selectedVariant.product_variant_name,
      unit_price: selectedVariant.unit_price || 0,
      quantity: finalQuantity,
      discount_percentage: discountPercentage,
      discount: discount,
      total_order_item_value: total,
      is_pallet: isPalletBased,
      pallets: finalPallets, // Always include pallets, default to 0 for non-pallet items
      layers: finalLayers, // Always include layers, default to 0 for non-pallet items
      unit: selectedProduct.unit,
      feet_per_layer: selectedProduct.feet_per_layer,
      layers_per_pallet: selectedProduct.layers_per_pallet,
    }

    console.log("Adding/updating order item:", newItem)

    if (editingItemId) {
      // Update existing item
      setOrderItems((prev) => prev.map((item) => (item.id === editingItemId ? newItem : item)))
    } else {
      // Add new item
      setOrderItems((prev) => [...prev, newItem])
    }

    // Reset form and hide it
    setShowAddItemForm(false)
    setSelectedProduct(null)
    setSelectedVariant(null)
    setQuantity(0)
    setPallets(0)
    setLayers(0)
    setDiscountPercentage(0)
    setEditingItemId(null)
  }, [
    selectedProduct,
    selectedVariant,
    quantity,
    pallets,
    layers,
    discountPercentage,
    editingItemId,
    calculatePalletsFromTotal,
    setOrderItems,
    roundQuantity,
  ])

  // Show delete confirmation dialog
  const showDeleteConfirmation = useCallback((item: OrderItem) => {
    setItemToDelete(item)
    setIsDeleteDialogOpen(true)
  }, [])

  // Handle actual item removal after confirmation
  const handleRemoveItem = useCallback(
    (id: string) => {
      // Find the item to be removed
      const itemToRemove = orderItems.find((item) => item.id === id)

      if (itemToRemove) {
        setIsDeleting(true)

        // Add to the set of removed item IDs
        setRemovedItemIds((prev) => {
          const newSet = new Set(prev)
          newSet.add(id)
          return newSet
        })

        // Remove the item from the order items
        setOrderItems((prev) => prev.filter((item) => item.id !== id))

        // Notify parent component about the removed item for inventory tracking
        if (onItemRemoved) {
          onItemRemoved(itemToRemove)
        }

        console.log(`Item removed: ${id}`)

        // Add a small delay to ensure inventory calculations have time to complete
        setTimeout(() => {
          setIsDeleting(false)
          setIsDeleteDialogOpen(false)
          setItemToDelete(null)
        }, 300)
      }
    },
    [orderItems, setOrderItems, onItemRemoved],
  )

  // Handle confirmation dialog actions
  const handleConfirmDelete = useCallback(() => {
    if (itemToDelete) {
      handleRemoveItem(itemToDelete.id)
    }
  }, [itemToDelete, handleRemoveItem])

  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false)
    setItemToDelete(null)
  }, [])

  // Determine if the Add Item button should be enabled
  const isAddItemEnabled = useCallback(() => {
    if (!selectedProduct || !selectedVariant) return false
    return quantity > 0
  }, [selectedProduct, selectedVariant, quantity])

  // Get the selected options for each dropdown
  const selectedManufacturerOption = useMemo(() => {
    if (!selectedManufacturerId) return { value: "all", label: "All Manufacturers" }
    const manufacturer = manufacturers.find((m) => m.id === selectedManufacturerId)
    return manufacturer
      ? { value: manufacturer.id, label: manufacturer.manufacturer_name }
      : { value: "all", label: "All Manufacturers" }
  }, [selectedManufacturerId, manufacturers])

  const selectedCategoryOption = useMemo(() => {
    if (!selectedCategory) return { value: "all", label: "All Categories" }
    return { value: selectedCategory, label: selectedCategory }
  }, [selectedCategory])

  const selectedProductOption = useMemo(() => {
    if (!selectedProduct) return null
    return { value: selectedProduct.id, label: selectedProduct.product_name }
  }, [selectedProduct])

  // Custom formatter for variant options in the dropdown
  const formatVariantOptionLabel = useCallback((option: SearchableSelectOption) => {
    const { label, customData } = option
    const { sku, quantity } = customData || { sku: "", quantity: 0 }

    return (
      <div className="flex items-center justify-between w-full py-1">
        <div className="flex flex-col">
          <span className="font-medium">{label}</span>
          {sku && <span className="text-xs text-muted-foreground">SKU: {sku}</span>}
        </div>
        {typeof quantity === "number" && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              quantity > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            Stock: {quantity}
          </span>
        )}
      </div>
    )
  }, [])

  const selectedVariantOption = useMemo(() => {
    if (!selectedVariant) return null
    return {
      value: selectedVariant.id,
      label: selectedVariant.product_variant_name,
      customData: {
        sku: selectedVariant.product_variant_sku,
        quantity: selectedVariant.quantity || 0,
      },
    }
  }, [selectedVariant])

  // Filter out any items that have been removed
  const filteredOrderItems = useMemo(() => {
    return orderItems.filter((item) => !removedItemIds.has(item.id))
  }, [orderItems, removedItemIds])

  // Helper function to check if a unit is a special unit (Square Feet or Linear Feet)
  const isSpecialUnit = useCallback((unit: string | null): boolean => {
    return unit === "Square Feet" || unit === "Linear Feet"
  }, [])

  // Get the display quantity based on rounding setting
  const getDisplayQuantity = useCallback(() => {
    if (!selectedProduct || !selectedVariant) return 0

    if (roundQuantity && isSpecialUnit(selectedProduct.unit)) {
      return calculateRoundedQuantity()
    }
    return quantity
  }, [selectedProduct, selectedVariant, quantity, roundQuantity, isSpecialUnit, calculateRoundedQuantity])

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>Add products to this order</CardDescription>
          </div>
          {!showAddItemForm && (
            <Button
              onClick={(e) => {
                e.preventDefault() // Prevent any form submission
                handleAddNewItem()
              }}
              type="button" // Explicitly set type to button to prevent form submission
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showAddItemForm && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg mb-6">
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium">Add Order Item</h3>
                <Button variant="ghost" size="icon" onClick={handleCancelForm} className="h-8 w-8">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
              <div className="p-4 space-y-4">
                {/* Product Category dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="category">Product Category</Label>
                  <SearchableSelect
                    id="category"
                    options={categoryOptions}
                    value={selectedCategoryOption}
                    onChange={handleCategoryChange}
                    isDisabled={categoriesByManufacturer.length === 0}
                    placeholder="Select category"
                    className="bg-white"
                  />
                </div>

                {/* Product dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="product" className="flex items-center">
                    Product <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <SearchableSelect
                    id="product"
                    options={productOptions}
                    value={selectedProductOption}
                    onChange={handleProductChange}
                    isDisabled={filteredProducts.length === 0}
                    placeholder="Search products..."
                    className="bg-white"
                  />
                </div>

                {/* Variant dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="variant" className="flex items-center">
                    Variant <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <SearchableSelect
                    id="variant"
                    options={variantOptions}
                    value={selectedVariantOption}
                    onChange={handleVariantChange}
                    isDisabled={!selectedProduct}
                    placeholder="Search variants..."
                    formatOptionLabel={formatVariantOptionLabel}
                    className="bg-white"
                  />
                </div>

                {selectedProduct && selectedVariant && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity ({selectedProduct.unit}) *</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="0"
                          step="1" // Always use step of 1 to enforce integers
                          value={quantity}
                          onChange={(e) => handleQuantityChange(Number.parseFloat(e.target.value) || 0)}
                          className="bg-white"
                        />
                        {isSpecialUnit(selectedProduct.unit) && quantity > 0 && (
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-sm text-muted-foreground">
                              {roundQuantity ? (
                                <>
                                  Rounded to the nearest layer: {calculateRoundedQuantity()} {selectedProduct.unit}
                                </>
                              ) : (
                                <>
                                  Exact quantity: {quantity} {selectedProduct.unit}
                                </>
                              )}
                              <br />({pallets} pallets, {layers} layers)
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">Round</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={roundQuantity}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
                                  roundQuantity ? "bg-gray-700" : "bg-gray-200"
                                }`}
                                onClick={() => setRoundQuantity(!roundQuantity)}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    roundQuantity ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
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
                          onChange={(e) => setDiscountPercentage(Number.parseFloat(e.target.value) || 0)}
                          className="bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-gray-200 pt-4">
                      <div className="flex justify-between">
                        <span>Unit Price:</span>
                        <span>{formatCurrency(selectedVariant.unit_price || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Quantity:</span>
                        <span>
                          {getDisplayQuantity()} {selectedProduct.unit}
                        </span>
                      </div>
                      {discountPercentage > 0 && (
                        <div className="flex justify-between">
                          <span>Discount ({discountPercentage}%):</span>
                          <span>
                            {formatCurrency(
                              (selectedVariant.unit_price || 0) * getDisplayQuantity() * (discountPercentage / 100),
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

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-4">
                  <Button variant="outline" onClick={handleCancelForm}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddItem}
                    disabled={!isAddItemEnabled()}
                    className="bg-gray-700 hover:bg-gray-800"
                  >
                    Add Item
                  </Button>
                </div>
              </div>
            </div>
          )}

          {filteredOrderItems.length === 0 ? (
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
                {filteredOrderItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.product_name}
                      {isSpecialUnit(item.unit) && item.feet_per_layer && item.layers_per_pallet && (
                        <span className="text-xs text-muted-foreground block">
                          ({item.feet_per_layer} ft/layer, {item.layers_per_pallet} layers/pallet)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{item.variant_name}</TableCell>
                    <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell>
                      {Math.ceil(item.quantity)} {item.unit}
                      {isSpecialUnit(item.unit) && (
                        <span className="text-xs text-muted-foreground block">
                          ({item.pallets} pallets, {item.layers} layers)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.discount_percentage > 0 ? (
                        <>
                          {item.discount_percentage}%
                          <span className="text-xs text-muted-foreground block">({formatCurrency(item.discount)})</span>
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
                ))}
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
                    {Math.ceil(itemToDelete.quantity)} {itemToDelete.unit}
                    {isSpecialUnit(itemToDelete.unit) && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({itemToDelete.pallets} pallets, {itemToDelete.layers} layers)
                      </span>
                    )}
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
