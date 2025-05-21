"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  formatCurrency,
  getCurrentTimestamp,
  quantityToPalletsAndLayers,
  palletsAndLayersToQuantity,
} from "@/lib/utils"
import { PlusCircle, Pencil, Trash2, Upload, X, ImageIcon, Loader2, RefreshCw, Settings } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

interface ProductVariant {
  id: string
  product_id: string
  product_variant_name: string
  product_variant_sku: string
  product_variant_image: string | null
  colour: string | null
  quantity: number | null
  unit_price: number | null
  unit_margin: number | null
  pallets: number | null
  layers: number | null
  is_archived: boolean | null
  date_created: string
  date_last_updated: string
  warning_threshold: number | null
  critical_threshold: number | null
  max_quantity: number | null
}

interface ProductVariantsSectionProps {
  productId?: string
  unit: string
  isNewProduct?: boolean
  showAddDialog?: boolean
  onAddDialogChange?: (open: boolean) => void
  initialVariants?: ProductVariant[]
  refreshTrigger?: number
}

// Constants
const STORAGE_BUCKET = "product-variant-images"

// Default static conversion rates
const DEFAULT_FEET_PER_LAYER = 100 // Default square feet per layer
const DEFAULT_LAYERS_PER_PALLET = 10 // Default layers per pallet

export default function ProductVariantsSection({
  productId,
  unit,
  isNewProduct = false,
  showAddDialog = false,
  onAddDialogChange,
  initialVariants = [],
  refreshTrigger = 0,
}: ProductVariantsSectionProps) {
  const supabase = getSupabaseClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasInitializedRef = useRef(false)
  const fetchInProgressRef = useRef(false)
  const calculationInProgressRef = useRef(false)

  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [currentVariant, setCurrentVariant] = useState<Partial<ProductVariant> | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(isEditing)
  const [loading, setLoading] = useState(false)
  const [quantityInputMethod, setQuantityInputMethod] = useState<"exact" | "pallets">("exact")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [variantsInitialized, setVariantsInitialized] = useState(false)
  const [isFetchingVariants, setIsFetchingVariants] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [variantToDelete, setVariantToDelete] = useState<ProductVariant | null>(null)
  const [productDetails, setProductDetails] = useState<{
    feet_per_layer: number | null
    layers_per_pallet: number | null
  } | null>(null)

  // New state for conversion rate configuration
  const [conversionRates, setConversionRates] = useState({
    feetPerLayer: DEFAULT_FEET_PER_LAYER,
    layersPerPallet: DEFAULT_LAYERS_PER_PALLET,
  })

  // New state for displaying calculated values
  const [calculatedValues, setCalculatedValues] = useState({
    squareFootage: 0,
    pallets: 0,
    layers: 0,
  })

  // State for conversion rate configuration dialog
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false)

  const isSpecialUnit = unit === "Square Feet" || unit === "Linear Feet"

  // Create a memoized fetchVariants function to avoid recreation on each render
  const fetchVariants = useCallback(async () => {
    if (!productId || fetchInProgressRef.current) return

    try {
      fetchInProgressRef.current = true
      setIsFetchingVariants(true)

      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("product_variant_name", { ascending: true })

      if (error) throw error

      setVariants(data || [])
      setVariantsInitialized(true)
    } catch (error) {
      console.error("Error fetching product variants:", error)
      toast({
        title: "Error",
        description: "Failed to load product variants",
        variant: "destructive",
      })
    } finally {
      setIsFetchingVariants(false)
      fetchInProgressRef.current = false
    }
  }, [productId, supabase, toast])

  // Fetch product details (feet_per_layer and layers_per_pallet)
  const fetchProductDetails = useCallback(async () => {
    if (!productId) return

    try {
      const { data, error } = await supabase
        .from("products")
        .select("feet_per_layer, layers_per_pallet")
        .eq("id", productId)
        .single()

      if (error) throw error

      if (data) {
        setProductDetails({
          feet_per_layer: data.feet_per_layer,
          layers_per_pallet: data.layers_per_pallet,
        })

        // Update conversion rates if product-specific values are available
        if (data.feet_per_layer && data.layers_per_pallet) {
          setConversionRates({
            feetPerLayer: data.feet_per_layer,
            layersPerPallet: data.layers_per_pallet,
          })
        }
      }
    } catch (error) {
      console.error("Error fetching product details:", error)
    }
  }, [productId, supabase])

  // Initialize variants from props if available or fetch them
  useEffect(() => {
    // Only run this effect once for initialization
    if (hasInitializedRef.current) return

    if (productId) {
      fetchVariants()
      fetchProductDetails()
      hasInitializedRef.current = true
    } else if (initialVariants && initialVariants.length > 0) {
      setVariants(initialVariants)
      setVariantsInitialized(true)
      hasInitializedRef.current = true
    }
  }, [productId, initialVariants, fetchVariants, fetchProductDetails])

  // Handle refresh trigger separately
  useEffect(() => {
    if (refreshTrigger > 0 && productId) {
      fetchVariants()
      fetchProductDetails()
    }
  }, [refreshTrigger, productId, fetchVariants, fetchProductDetails])

  // Set up a real-time subscription to product_variants table
  useEffect(() => {
    if (!productId) return

    // Set up a subscription for real-time updates
    const channel = supabase
      .channel(`product_variants_${productId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_variants",
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          // Instead of calling fetchVariants directly, update the local state
          // based on the change type
          if (payload.eventType === "INSERT") {
            const newVariant = payload.new as ProductVariant
            setVariants((prev) => [...prev, newVariant])
          } else if (payload.eventType === "UPDATE") {
            const updatedVariant = payload.new as ProductVariant
            setVariants((prev) => prev.map((v) => (v.id === updatedVariant.id ? updatedVariant : v)))
          } else if (payload.eventType === "DELETE") {
            const deletedVariantId = payload.old.id
            setVariants((prev) => prev.filter((v) => v.id !== deletedVariantId))
          }
        },
      )
      .subscribe()

    return () => {
      // Clean up the subscription when the component unmounts
      supabase.removeChannel(channel)
    }
  }, [productId, supabase])

  // Handle external control of dialog
  useEffect(() => {
    if (showAddDialog && !isDialogOpen && productId) {
      openAddDialog()
    }
  }, [showAddDialog, productId, isDialogOpen])

  // Update the parent component when dialog state changes
  const updateDialogState = (open: boolean) => {
    setIsDialogOpen(open)
    if (onAddDialogChange) {
      onAddDialogChange(open)
    }
  }

  const openAddDialog = () => {
    if (!productId) return

    setCurrentVariant({
      id: uuidv4(), // Generate a new ID for the variant
      product_id: productId,
      product_variant_name: "",
      product_variant_sku: "",
      product_variant_image: null,
      colour: "",
      quantity: 0,
      unit_price: 0,
      unit_margin: 0,
      pallets: 0,
      layers: 0,
      is_archived: false,
      warning_threshold: null,
      critical_threshold: null,
      max_quantity: null,
    })
    setIsEditing(false)
    setQuantityInputMethod("exact")
    setSelectedFile(null)
    setPreviewUrl(null)

    // Reset calculated values
    setCalculatedValues({
      squareFootage: 0,
      pallets: 0,
      layers: 0,
    })

    updateDialogState(true)
  }

  const openEditDialog = (variant: ProductVariant) => {
    // Calculate margin percentage from the stored amount
    const marginPercentage =
      variant.unit_price && variant.unit_margin ? (variant.unit_margin / variant.unit_price) * 100 : variant.unit_margin

    setCurrentVariant({
      ...variant,
      unit_margin: marginPercentage,
    })
    setIsEditing(true)
    setQuantityInputMethod(variant.pallets || variant.layers ? "pallets" : "exact")
    setSelectedFile(null)

    // Only set preview URL if it's a valid string
    if (variant.product_variant_image && typeof variant.product_variant_image === "string") {
      setPreviewUrl(variant.product_variant_image)
    } else {
      setPreviewUrl(null)
    }

    // Initialize calculated values based on the variant
    const squareFootage = variant.quantity || 0
    const pallets = variant.pallets || 0
    const layers = variant.layers || 0

    setCalculatedValues({
      squareFootage,
      pallets,
      layers,
    })

    updateDialogState(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentVariant) return

    const { name, value, type } = e.target

    if (type === "number") {
      const numValue = value === "" ? null : Number.parseFloat(value)

      setCurrentVariant({
        ...currentVariant,
        [name]: numValue,
      })

      // Trigger calculations when quantity, pallets, or layers change
      if (name === "quantity" || name === "pallets" || name === "layers") {
        updateCalculatedValues(name, numValue)
      }
    } else {
      setCurrentVariant({
        ...currentVariant,
        [name]: value,
      })
    }
  }

  // Function to update calculated values based on input changes
  const updateCalculatedValues = (changedField: string, value: number | null) => {
    if (value === null) return

    const { feetPerLayer, layersPerPallet } = conversionRates

    if (changedField === "quantity") {
      // Calculate pallets and layers from quantity using the utility function
      const { pallets, layers } = quantityToPalletsAndLayers(value, feetPerLayer, layersPerPallet)

      setCalculatedValues({
        squareFootage: value,
        pallets,
        layers,
      })

      // Update currentVariant with calculated values
      if (quantityInputMethod === "exact") {
        setCurrentVariant((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            pallets,
            layers,
          }
        })
      }
    } else if (changedField === "pallets" || changedField === "layers") {
      // Get current values
      const currentPallets = changedField === "pallets" ? value : currentVariant?.pallets || 0
      const currentLayers = changedField === "layers" ? value : currentVariant?.layers || 0

      // Calculate square footage from pallets and layers using the utility function
      const squareFootage = palletsAndLayersToQuantity(currentPallets, currentLayers, feetPerLayer, layersPerPallet)

      setCalculatedValues({
        squareFootage,
        pallets: currentPallets,
        layers: currentLayers,
      })

      // Update currentVariant with calculated square footage
      if (quantityInputMethod === "pallets") {
        setCurrentVariant((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            quantity: squareFootage,
          }
        })
      }
    }
  }

  const handleCheckboxChange = (name: string, checked: boolean) => {
    if (!currentVariant) return

    setCurrentVariant({
      ...currentVariant,
      [name]: checked,
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, GIF, or WebP image.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)

    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (currentVariant) {
      setCurrentVariant({
        ...currentVariant,
        product_variant_image: null,
      })
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create a unique file name
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      const filePath = `${productId}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        throw new Error(`Failed to upload image: ${uploadError.message}`)
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)

      setUploadProgress(100)
      return publicUrl
    } catch (error) {
      console.error("Error uploading image:", error)

      toast({
        title: "Image Upload Failed",
        description: "Could not upload the image. You can continue without an image or try again later.",
        variant: "destructive",
      })

      return null
    } finally {
      setIsUploading(false)
    }
  }

  // Calculate quantity from pallets and layers, rounding up to the nearest whole number
  const calculateQuantityFromPalletsLayers = useCallback(() => {
    if (!currentVariant || !isSpecialUnit || calculationInProgressRef.current) return

    const { feetPerLayer, layersPerPallet } = conversionRates

    const pallets = currentVariant.pallets || 0
    const layers = currentVariant.layers || 0

    // Calculate quantity using the utility function
    const quantity = palletsAndLayersToQuantity(pallets, layers, feetPerLayer, layersPerPallet)

    // Round up to the nearest whole number
    const roundedQuantity = Math.ceil(quantity)

    // Only update if the value has changed to prevent infinite loops
    if (currentVariant.quantity !== roundedQuantity) {
      calculationInProgressRef.current = true
      setCurrentVariant((prev) => {
        if (!prev) return prev
        const updated = {
          ...prev,
          quantity: roundedQuantity,
        }
        setTimeout(() => {
          calculationInProgressRef.current = false
        }, 0)
        return updated
      })

      // Update calculated values
      setCalculatedValues((prev) => ({
        ...prev,
        squareFootage: roundedQuantity,
      }))
    }
  }, [currentVariant, isSpecialUnit, conversionRates])

  // Calculate pallets and layers from quantity
  const calculatePalletsLayersFromQuantity = useCallback(() => {
    if (!currentVariant || !isSpecialUnit || calculationInProgressRef.current) return

    const { feetPerLayer, layersPerPallet } = conversionRates

    if (currentVariant.quantity === null || currentVariant.quantity === undefined) return

    // Round up the quantity to ensure it's a whole number
    const roundedQuantity = Math.ceil(currentVariant.quantity)

    // Calculate pallets and layers using the utility function
    const { pallets, layers } = quantityToPalletsAndLayers(roundedQuantity, feetPerLayer, layersPerPallet)

    // Only update if values have changed to prevent infinite loops
    if (
      currentVariant.quantity !== roundedQuantity ||
      currentVariant.pallets !== pallets ||
      currentVariant.layers !== layers
    ) {
      calculationInProgressRef.current = true
      setCurrentVariant((prev) => {
        if (!prev) return prev
        const updated = {
          ...prev,
          quantity: roundedQuantity,
          pallets,
          layers,
        }
        setTimeout(() => {
          calculationInProgressRef.current = false
        }, 0)
        return updated
      })

      // Update calculated values
      setCalculatedValues({
        squareFootage: roundedQuantity,
        pallets,
        layers,
      })
    }
  }, [currentVariant, isSpecialUnit, conversionRates])

  // Handle quantity input method change
  const handleQuantityInputMethodChange = (value: "exact" | "pallets") => {
    setQuantityInputMethod(value)
  }

  // Perform calculations when input method or relevant values change
  useEffect(() => {
    if (!currentVariant || calculationInProgressRef.current) return

    // Use a timeout to ensure we don't get into an update loop
    const timer = setTimeout(() => {
      if (quantityInputMethod === "pallets") {
        calculateQuantityFromPalletsLayers()
      } else if (quantityInputMethod === "exact") {
        calculatePalletsLayersFromQuantity()
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [quantityInputMethod, calculateQuantityFromPalletsLayers, calculatePalletsLayersFromQuantity, currentVariant])

  // Handle conversion rate changes
  const handleConversionRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const numValue = value === "" ? 0 : Number.parseFloat(value)

    setConversionRates((prev) => ({
      ...prev,
      [name]: numValue,
    }))
  }

  // Save conversion rates to product
  const saveConversionRates = async () => {
    if (!productId) return

    try {
      const { error } = await supabase
        .from("products")
        .update({
          feet_per_layer: conversionRates.feetPerLayer,
          layers_per_pallet: conversionRates.layersPerPallet,
          date_last_updated: getCurrentTimestamp(),
        })
        .eq("id", productId)

      if (error) throw error

      toast({
        title: "Conversion Rates Updated",
        description: "The conversion rates have been saved successfully.",
      })

      setIsConversionDialogOpen(false)

      // Recalculate values with new rates
      if (currentVariant) {
        if (quantityInputMethod === "exact" && currentVariant.quantity !== null) {
          updateCalculatedValues("quantity", currentVariant.quantity)
        } else if (quantityInputMethod === "pallets") {
          updateCalculatedValues("pallets", currentVariant.pallets || 0)
        }
      }
    } catch (error) {
      console.error("Error saving conversion rates:", error)
      toast({
        title: "Error",
        description: "Failed to save conversion rates. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentVariant || !productId) return

    setLoading(true)

    try {
      const timestamp = getCurrentTimestamp()
      const userId = (await supabase.auth.getUser()).data.user?.id

      // Handle image upload if there's a selected file
      let imageUrl = currentVariant.product_variant_image
      if (selectedFile) {
        try {
          const uploadedUrl = await uploadImage(selectedFile)
          if (uploadedUrl) {
            imageUrl = uploadedUrl
          }
          // If uploadedUrl is null, keep the existing image URL
        } catch (uploadError) {
          console.error("Image upload failed:", uploadError)
          // Continue without changing the image
        }
      }

      // Ensure all numeric fields are properly rounded to integers where needed
      const variantData = {
        ...currentVariant,
        product_id: productId,
        product_variant_image: imageUrl,
        date_last_updated: timestamp,
        updated_by_user_id: userId || null,
        // Convert margin percentage to actual amount
        unit_margin:
          currentVariant.unit_price !== null && currentVariant.unit_margin !== null
            ? currentVariant.unit_price * (currentVariant.unit_margin / 100)
            : null,
        // Round up quantity to nearest integer
        quantity:
          currentVariant.quantity !== null && currentVariant.quantity !== undefined
            ? Math.ceil(currentVariant.quantity)
            : null,
        // Ensure pallets and layers are integers
        pallets:
          currentVariant.pallets !== null && currentVariant.pallets !== undefined
            ? Math.floor(currentVariant.pallets)
            : null,
        layers:
          currentVariant.layers !== null && currentVariant.layers !== undefined
            ? Math.floor(currentVariant.layers)
            : null,
        // Ensure thresholds are integers
        warning_threshold:
          currentVariant.warning_threshold !== null && currentVariant.warning_threshold !== undefined
            ? Math.floor(currentVariant.warning_threshold)
            : null,
        critical_threshold:
          currentVariant.critical_threshold !== null && currentVariant.critical_threshold !== undefined
            ? Math.floor(currentVariant.critical_threshold)
            : null,
        max_quantity:
          currentVariant.max_quantity !== null && currentVariant.max_quantity !== undefined
            ? Math.floor(currentVariant.max_quantity)
            : null,
      }

      if (!isEditing) {
        variantData.date_created = timestamp
        variantData.created_by_user_id = userId || null
      }

      let result

      if (isEditing && currentVariant.id) {
        // Update existing variant
        result = await supabase.from("product_variants").update(variantData).eq("id", currentVariant.id)
      } else {
        // Create new variant
        result = await supabase.from("product_variants").insert(variantData)
      }

      if (result.error) throw result.error

      toast({
        title: isEditing ? "Variant Updated" : "Variant Created",
        description: `${currentVariant.product_variant_name} has been ${isEditing ? "updated" : "created"} successfully.`,
      })

      updateDialogState(false)

      // Immediately update the local state with the new/updated variant
      if (isEditing) {
        // Update the existing variant in the array
        setVariants((prev) =>
          prev.map((v) => (v.id === currentVariant.id ? ({ ...v, ...variantData } as ProductVariant) : v)),
        )
      } else {
        // Add the new variant to the array
        setVariants((prev) => [...prev, variantData as ProductVariant])
      }

      // Set variantsInitialized to true to ensure proper rendering
      setVariantsInitialized(true)
    } catch (error) {
      console.error("Error saving product variant:", error)
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "create"} product variant. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (variant: ProductVariant) => {
    setVariantToDelete(variant)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!variantToDelete) return

    try {
      const { error } = await supabase.from("product_variants").delete().eq("id", variantToDelete.id)

      if (error) throw error

      toast({
        title: "Variant Deleted",
        description: `${variantToDelete.product_variant_name} has been permanently deleted.`,
      })

      // Update the local state immediately
      setVariants((prev) => prev.filter((v) => v.id !== variantToDelete.id))
    } catch (error) {
      console.error("Error deleting variant:", error)
      toast({
        title: "Error",
        description: "Failed to delete variant. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setVariantToDelete(null)
    }
  }

  const handleArchiveVariant = async (variant: ProductVariant) => {
    try {
      const timestamp = getCurrentTimestamp()
      const userId = (await supabase.auth.getUser()).data.user?.id

      const { error } = await supabase
        .from("product_variants")
        .update({
          is_archived: !variant.is_archived,
          date_last_updated: timestamp,
          updated_by_user_id: userId || null,
        })
        .eq("id", variant.id)

      if (error) throw error

      toast({
        title: variant.is_archived ? "Variant Restored" : "Variant Archived",
        description: `${variant.product_variant_name} has been ${variant.is_archived ? "restored" : "archived"} successfully.`,
      })

      // Update the local state immediately
      setVariants((prev) => prev.map((v) => (v.id === variant.id ? { ...v, is_archived: !variant.is_archived } : v)))
    } catch (error) {
      console.error("Error updating variant archive status:", error)
      toast({
        title: "Error",
        description: "Failed to update variant status. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Determine if we should show the loading state or empty state
  const showLoadingState = !variantsInitialized || isFetchingVariants
  const showEmptyState = variantsInitialized && !isFetchingVariants && variants.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Product Variants</h2>
        <div className="flex items-center gap-2">
          {isSpecialUnit && productId && (
            <Button variant="outline" size="sm" onClick={() => setIsConversionDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Conversion Rates
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchVariants()}
            disabled={isFetchingVariants || !productId}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingVariants ? "animate-spin" : ""}`} />
            Refresh Variants
          </Button>
          {productId && (
            <Button onClick={openAddDialog} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Variant
            </Button>
          )}
        </div>
      </div>

      {!productId ? (
        <div className="text-center py-8 text-muted-foreground">Save the product first to add variants.</div>
      ) : showLoadingState ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Loading variants...</p>
        </div>
      ) : showEmptyState ? (
        <div className="text-center py-8 text-muted-foreground">
          No variants found for this product. Click "Add Variant" to create one.
        </div>
      ) : (
        <div className="space-y-4">
          {variants.map((variant) => (
            <Card key={variant.id} className={variant.is_archived ? "bg-muted" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    {variant.product_variant_image ? (
                      <div className="h-16 w-16 rounded-md overflow-hidden flex-shrink-0">
                        <img
                          src={variant.product_variant_image || "/placeholder.svg"}
                          alt={variant.product_variant_name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null
                            e.currentTarget.src = "/placeholder.svg"
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium">{variant.product_variant_name}</h3>
                      <p className="text-sm text-muted-foreground">SKU: {variant.product_variant_sku}</p>
                      {variant.colour && <p className="text-sm">Color: {variant.colour}</p>}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Quantity:</p>
                        <p>
                          {variant.quantity || 0} {unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Unit Price:</p>
                        <p>{formatCurrency(variant.unit_price || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Unit Margin:</p>
                        <p>
                          {variant.unit_price
                            ? `${(((variant.unit_margin || 0) / (variant.unit_price || 1)) * 100).toFixed(1)}%`
                            : "0%"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Value:</p>
                        <p>{formatCurrency((variant.quantity || 0) * (variant.unit_price || 0))}</p>
                      </div>
                      {isSpecialUnit && variant.pallets !== null && variant.layers !== null && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Storage:</p>
                          <p>
                            {variant.pallets} pallets, {variant.layers} layers
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(variant)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(variant)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Conversion Rates Configuration Dialog */}
      <Dialog open={isConversionDialogOpen} onOpenChange={setIsConversionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Conversion Rates</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feetPerLayer">Square Feet per Layer</Label>
              <Input
                id="feetPerLayer"
                name="feetPerLayer"
                type="number"
                min="1"
                step="0.1"
                value={conversionRates.feetPerLayer}
                onChange={handleConversionRateChange}
              />
              <p className="text-xs text-muted-foreground">How many square feet are in one layer</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="layersPerPallet">Layers per Pallet</Label>
              <Input
                id="layersPerPallet"
                name="layersPerPallet"
                type="number"
                min="1"
                step="1"
                value={conversionRates.layersPerPallet}
                onChange={handleConversionRateChange}
              />
              <p className="text-xs text-muted-foreground">How many layers are in one pallet</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConversionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveConversionRates}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={updateDialogState}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 z-10 bg-background pb-4">
            <DialogTitle>{isEditing ? "Edit Product Variant" : "Add Product Variant"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Basic Information - First Column */}
              <div className="space-y-4 md:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product_variant_name">Variant Name *</Label>
                    <Input
                      id="product_variant_name"
                      name="product_variant_name"
                      value={currentVariant?.product_variant_name || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product_variant_sku">SKU *</Label>
                    <Input
                      id="product_variant_sku"
                      name="product_variant_sku"
                      value={currentVariant?.product_variant_sku || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="colour">Color</Label>
                    <Input
                      id="colour"
                      name="colour"
                      value={currentVariant?.colour || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. Red, Blue, #FF0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit_price">Unit Price ($) *</Label>
                    <Input
                      id="unit_price"
                      name="unit_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentVariant?.unit_price ?? ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit_margin">Unit Margin (%) *</Label>
                    <div className="relative">
                      <Input
                        id="unit_margin"
                        name="unit_margin"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={currentVariant?.unit_margin ?? ""}
                        onChange={handleInputChange}
                        required
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>

                {/* Quantity Section */}
                <div className="border-t pt-4">
                  {isSpecialUnit && (
                    <div className="mb-4">
                      <Label className="mb-2 block">Quantity Input Method</Label>
                      <RadioGroup
                        value={quantityInputMethod}
                        onValueChange={(value) => handleQuantityInputMethodChange(value as "exact" | "pallets")}
                        className="flex space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="exact" id="exact" />
                          <Label htmlFor="exact">Exact {unit}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="pallets" id="pallets" />
                          <Label htmlFor="pallets">Pallets and Layers</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {quantityInputMethod === "exact" || !isSpecialUnit ? (
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity ({unit}) *</Label>
                        <Input
                          id="quantity"
                          name="quantity"
                          type="number"
                          min="0"
                          step="1"
                          value={currentVariant?.quantity ?? ""}
                          onChange={handleInputChange}
                          required
                        />

                        {isSpecialUnit && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Equivalent: {calculatedValues.pallets} pallets, {calculatedValues.layers} layers
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="pallets">Pallets *</Label>
                          <Input
                            id="pallets"
                            name="pallets"
                            type="number"
                            min="0"
                            step="1"
                            value={currentVariant?.pallets ?? ""}
                            onChange={handleInputChange}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="layers">Layers *</Label>
                          <Input
                            id="layers"
                            name="layers"
                            type="number"
                            min="0"
                            step="1"
                            value={currentVariant?.layers ?? ""}
                            onChange={handleInputChange}
                            required
                          />

                          <div className="mt-2 text-sm text-muted-foreground">
                            Equivalent: {calculatedValues.squareFootage} {unit}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Inventory Thresholds Section */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="warning_threshold">Warning Threshold</Label>
                      <Input
                        id="warning_threshold"
                        name="warning_threshold"
                        type="number"
                        min="0"
                        step="1"
                        value={currentVariant?.warning_threshold ?? ""}
                        onChange={handleInputChange}
                        placeholder="Warning level"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="critical_threshold">Critical Threshold</Label>
                      <Input
                        id="critical_threshold"
                        name="critical_threshold"
                        type="number"
                        min="0"
                        step="1"
                        value={currentVariant?.critical_threshold ?? ""}
                        onChange={handleInputChange}
                        placeholder="Critical level"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max_quantity">Maximum Quantity</Label>
                      <Input
                        id="max_quantity"
                        name="max_quantity"
                        type="number"
                        min="0"
                        step="1"
                        value={currentVariant?.max_quantity ?? ""}
                        onChange={handleInputChange}
                        placeholder="Max capacity"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>Set inventory thresholds to receive alerts when stock levels change</p>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex items-center space-x-2 mt-4">
                    <Checkbox
                      id="is_archived"
                      checked={currentVariant?.is_archived || false}
                      onCheckedChange={(checked) => handleCheckboxChange("is_archived", checked as boolean)}
                    />
                    <Label htmlFor="is_archived">Archived</Label>
                  </div>
                )}
              </div>

              {/* Image Upload - Second Column */}
              <div className="space-y-2">
                <Label htmlFor="product_variant_image">Variant Image</Label>
                <div className="flex flex-col space-y-2">
                  {previewUrl ? (
                    <div className="relative w-full h-40 bg-muted rounded-md overflow-hidden">
                      <img
                        src={previewUrl || "/placeholder.svg"}
                        alt="Preview"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-md p-4 text-center h-40 flex flex-col items-center justify-center">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Drag and drop or click to browse</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="product_variant_image"
                        name="product_variant_image"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2"
                      >
                        Select Image
                      </Button>
                    </div>
                  )}
                  {isUploading && (
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className="bg-primary h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 pt-4 bg-background z-10">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={loading || isUploading}>
                {loading ? "Saving..." : isEditing ? "Update Variant" : "Add Variant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {variantToDelete?.product_variant_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
