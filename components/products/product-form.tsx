"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
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
import { CheckCircle2 } from "lucide-react"

interface Manufacturer {
  id: string
  manufacturer_name: string
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
}

interface ProductFormProps {
  product?: Product
  isEditing?: boolean
}

export default function ProductForm({ product, isEditing = false }: ProductFormProps) {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [createdProductId, setCreatedProductId] = useState<string>("")
  const [productCreated, setProductCreated] = useState<boolean>(false)
  const [showAddVariantDialog, setShowAddVariantDialog] = useState<boolean>(false)

  const [formData, setFormData] = useState<Partial<Product>>({
    product_name: "",
    product_category: "",
    manufacturer_id: "",
    unit: "Each",
    feet_per_layer: null,
    layers_per_pallet: null,
    is_archived: false,
  })

  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
      })
    }

    fetchManufacturers()
    fetchCategories()
  }, [product])

  const fetchManufacturers = async () => {
    try {
      const { data, error } = await supabase
        .from("manufacturers")
        .select("id, manufacturer_name")
        .eq("is_archived", false)
        .order("manufacturer_name", { ascending: true })

      if (error) throw error
      setManufacturers(data || [])
    } catch (error) {
      console.error("Error fetching manufacturers:", error)
      toast({
        title: "Error",
        description: "Failed to load manufacturers",
        variant: "destructive",
      })
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from("products").select("product_category").eq("is_archived", false)

      if (error) throw error

      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map((item) => item.product_category).filter(Boolean))]
      setCategories(uniqueCategories)
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast({
        title: "Error",
        description: "Failed to load product categories",
        variant: "destructive",
      })
    }
  }

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

      if (!isEditing) {
        productData.date_created = timestamp
        productData.created_by_user_id = userId || null
      }

      let result

      if (isEditing && product?.id) {
        // Update existing product
        result = await supabase.from("products").update(productData).eq("id", product.id).select()

        if (result.error) throw result.error

        toast({
          title: "Product Updated",
          description: `${formData.product_name} has been updated successfully.`,
        })

        router.refresh()
      } else {
        // Create new product
        result = await supabase.from("products").insert(productData).select()

        if (result.error) throw result.error

        // Set the created product ID and show success state
        if (result.data && result.data[0]) {
          setCreatedProductId(result.data[0].id)
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
        description: `Failed to ${isEditing ? "update" : "create"} product. Please try again.`,
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
    setCreatedProductId("")
    setProductCreated(false)
    setShowAddVariantDialog(false)
  }

  const handleGoToProductsList = () => {
    router.push("/dashboard/products")
    router.refresh()
  }

  return (
    <div className="space-y-8">
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
              <CardTitle>{isEditing ? "Edit Product" : "Create New Product"}</CardTitle>
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
            <CardFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
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
          productId={isEditing ? product?.id : createdProductId}
          unit={formData.unit || "Each"}
          isNewProduct={false}
          showAddDialog={showAddVariantDialog}
          onAddDialogChange={setShowAddVariantDialog}
        />
      )}

      {/* Show action buttons after product creation */}
      {productCreated && (
        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={handleCreateAnotherProduct}>
            Create Another Product
          </Button>
          <Button onClick={handleGoToProductsList}>Go to Products List</Button>
        </div>
      )}
    </div>
  )
}
