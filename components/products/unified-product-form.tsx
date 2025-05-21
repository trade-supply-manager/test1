"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { getCurrentTimestamp } from "@/lib/utils"
import ProductVariantsSection from "./product-variants-section"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

interface Manufacturer {
  id: string
  manufacturer_name: string
}

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
}

interface Product {
  id: string
  product_name: string
  product_category: string
  manufacturer_id: string
  unit: string | null
  feet_per_layer: number | null
  layers_per_pallet: number | null
  is_archived: boolean | null
  date_created: string
  date_last_updated: string
  created_by_user_id: string | null
  updated_by_user_id: string | null
  manufacturers?: {
    id: string
    manufacturer_name: string
  }
  product_variants?: ProductVariant[]
}

interface ProductFormProps {
  initialProduct?: Product | null
}

export default function UnifiedProductForm({ initialProduct }: ProductFormProps) {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  // Determine if we're editing an existing product
  const isEditing = !!initialProduct?.id

  // State variables
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [productId, setProductId] = useState<string>(initialProduct?.id || "")
  const [productCreated, setProductCreated] = useState<boolean>(false)
  const [showAddVariantDialog, setShowAddVariantDialog] = useState<boolean>(false)
  const [refreshVariants, setRefreshVariants] = useState<number>(0)
  const [refreshingVariants, setRefreshingVariants] = useState<boolean>(false)

  // Initialize form data state - IMPORTANT: Set initial values directly from initialProduct
  const [formData, setFormData] = useState<Partial<Product>>({
    product_name: initialProduct?.product_name || "",
    product_category: initialProduct?.product_category || "",
    manufacturer_id: initialProduct?.manufacturer_id || "",
    unit: initialProduct?.unit || "Each",
    feet_per_layer: initialProduct?.feet_per_layer || null,
    layers_per_pallet: initialProduct?.layers_per_pallet || null,
    is_archived: initialProduct?.is_archived || false,
  })

  // Fetch manufacturers and categories on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch manufacturers
        const { data: manufacturersData, error: manufacturersError } = await supabase
          .from("manufacturers")
          .select("id, manufacturer_name")
          .eq("is_archived", false)
          .order("manufacturer_name", { ascending: true })

        if (manufacturersError) throw manufacturersError
        setManufacturers(manufacturersData || [])

        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("products")
          .select("product_category")
          .eq("is_archived", false)

        if (categoriesError) throw categoriesError

        // Extract unique categories
        const uniqueCategories = [...new Set(categoriesData?.map((item) => item.product_category).filter(Boolean))]
        setCategories(uniqueCategories)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load form data",
          variant: "destructive",
        })
      }
    }

    fetchData()
  }, [supabase, toast])

  // Update form data if initialProduct changes
  useEffect(() => {
    if (initialProduct) {
      setFormData({
        product_name: initialProduct.product_name || "",
        product_category: initialProduct.product_category || "",
        manufacturer_id: initialProduct.manufacturer_id || "",
        unit: initialProduct.unit || "Each",
        feet_per_layer: initialProduct.feet_per_layer,
        layers_per_pallet: initialProduct.layers_per_pallet,
        is_archived: initialProduct.is_archived || false,
      })

      setProductId(initialProduct.id)
    }
  }, [initialProduct])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target

    if (type === "number") {
      setFormData({
        ...formData,
        [name]: value === "" ? null : Number.parseFloat(value),
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    })

    // Reset feet_per_layer and layers_per_pallet if unit is not Square Feet or Linear Feet
    if (name === "unit" && value !== "Square Feet" && value !== "Linear Feet") {
      setFormData((prev) => ({
        ...prev,
        feet_per_layer: null,
        layers_per_pallet: null,
      }))
    }
  }

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData({
      ...formData,
      [name]: checked,
    })
  }

  // Update the handleSubmit function to properly set productCreated and reset isNewProduct
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const timestamp = getCurrentTimestamp()
      const userId = (await supabase.auth.getUser()).data.user?.id

      const productData = {
        ...formData,
        date_last_updated: timestamp,
        updated_by_user_id: userId || null,
      }

      let result

      if (isEditing) {
        // Update existing product
        result = await supabase.from("products").update(productData).eq("id", productId).select()

        if (result.error) throw result.error

        toast({
          title: "Product Updated",
          description: `${formData.product_name} has been updated successfully.`,
        })

        router.refresh()
        router.push("/dashboard/products")
      } else {
        // Generate a new UUID for the product
        const newProductId = uuidv4()

        // Create new product with the generated ID
        result = await supabase
          .from("products")
          .insert({
            id: newProductId,
            ...productData,
            date_created: timestamp,
            created_by_user_id: userId || null,
          })
          .select()

        if (result.error) throw result.error

        // Set the created product ID and show success state
        if (result.data && result.data[0]) {
          setProductId(result.data[0].id)
          setProductCreated(true)

          // Auto-open the add variant dialog after a short delay
          setTimeout(() => {
            setShowAddVariantDialog(true)
          }, 500)

          toast({
            title: "Product Created",
            description: `${formData.product_name} has been created successfully. You can now add variants.`,
          })
        }
      }
    } catch (error: any) {
      console.error("Error saving product:", error)
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "create"} product: ${error.message || "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnotherProduct = () => {
    // Reset form and states for creating another product
    setFormData({
      product_name: "",
      product_category: "",
      manufacturer_id: "",
      unit: "Each",
      feet_per_layer: null,
      layers_per_pallet: null,
      is_archived: false,
    })
    setProductId("")
    setProductCreated(false)
    setShowAddVariantDialog(false)
  }

  const handleGoToProductsList = () => {
    router.push("/dashboard/products")
  }

  const handleGoBack = () => {
    router.back()
  }

  const handleRefreshVariants = async () => {
    setRefreshingVariants(true)
    // Increment the refresh counter to trigger a re-fetch in the child component
    setRefreshVariants((prev) => prev + 1)

    // Simulate a delay to show the refresh animation
    setTimeout(() => {
      setRefreshingVariants(false)
    }, 1000)
  }

  return (
    <div className="space-y-8">
      {/* Back button above the container */}
      <Button variant="ghost" size="sm" className="flex items-center gap-1 mb-4" onClick={handleGoBack}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {productCreated ? (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Product Created Successfully</AlertTitle>
          <AlertDescription>
            {formData.product_name} has been created. You can now add variants below or create another product.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? "Edit Product" : ""}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="product_name">Product Name *</Label>
                  <Input
                    id="product_name"
                    name="product_name"
                    value={formData.product_name || ""}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manufacturer_id">Manufacturer *</Label>
                  <Select
                    name="manufacturer_id"
                    value={formData.manufacturer_id || ""}
                    onValueChange={(value) => handleSelectChange("manufacturer_id", value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      {manufacturers.map((manufacturer) => (
                        <SelectItem key={manufacturer.id} value={manufacturer.id}>
                          {manufacturer.manufacturer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  {newCategory ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="product_category">New Category *</Label>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setNewCategory(false)}
                          className="h-auto p-0"
                        >
                          Select existing
                        </Button>
                      </div>
                      <Input
                        id="product_category"
                        name="product_category"
                        value={formData.product_category || ""}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="product_category">Product Category *</Label>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setNewCategory(true)}
                          className="h-auto p-0"
                        >
                          Create new
                        </Button>
                      </div>
                      <Select
                        name="product_category"
                        value={formData.product_category || ""}
                        onValueChange={(value) => handleSelectChange("product_category", value)}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Select
                    name="unit"
                    value={formData.unit || "Each"}
                    onValueChange={(value) => handleSelectChange("unit", value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Each">Each</SelectItem>
                      <SelectItem value="Square Feet">Square Feet</SelectItem>
                      <SelectItem value="Linear Feet">Linear Feet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.unit === "Square Feet" || formData.unit === "Linear Feet") && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="feet_per_layer">Feet Per Layer *</Label>
                      <Input
                        id="feet_per_layer"
                        name="feet_per_layer"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.feet_per_layer ?? ""}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="layers_per_pallet">Layers Per Pallet *</Label>
                      <Input
                        id="layers_per_pallet"
                        name="layers_per_pallet"
                        type="number"
                        min="0"
                        step="1"
                        value={formData.layers_per_pallet ?? ""}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </>
                )}

                {isEditing && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_archived"
                      checked={formData.is_archived || false}
                      onCheckedChange={(checked) => handleCheckboxChange("is_archived", checked as boolean)}
                    />
                    <Label htmlFor="is_archived">Archived</Label>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* Show variants section for editing or after product creation */}
      {(isEditing || productCreated) && (
        <ProductVariantsSection
          productId={productId}
          unit={formData.unit || "Each"}
          isNewProduct={false} // Always false after product is created
          showAddDialog={showAddVariantDialog}
          onAddDialogChange={setShowAddVariantDialog}
          initialVariants={initialProduct?.product_variants}
          refreshTrigger={refreshVariants}
        />
      )}

      {/* Show action buttons after product creation */}
      {productCreated && (
        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={handleCreateAnotherProduct}>
            Create Another Product
          </Button>
          <Button variant="default" onClick={handleGoToProductsList}>
            Go to Products List
          </Button>
        </div>
      )}
    </div>
  )
}
