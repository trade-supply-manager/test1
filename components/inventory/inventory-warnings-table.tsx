"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { AlertTriangle, AlertCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Manufacturer {
  id: string
  manufacturer_name: string
}

interface ProductVariant {
  id: string
  product_variant_name: string
  product_variant_sku: string
  quantity: number
  pallets: number | null
  layers: number | null
  warning_threshold: number
  critical_threshold: number
  max_quantity: number | null
  unit_price: number | null
  product_id: string
  products: {
    product_name: string
    manufacturer_id: string
    unit: string
    feet_per_layer: number | null
    layers_per_pallet: number | null
    manufacturers: {
      id: string
      manufacturer_name: string
    }
  }
}

export function InventoryWarningsTable() {
  const [lowStockProducts, setLowStockProducts] = useState<ProductVariant[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingInventory, setIsUpdatingInventory] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        // Fetch all active product variants
        const { data: productsData, error: productsError } = await supabase
          .from("product_variants")
          .select(`
          id,
          product_variant_name,
          product_variant_sku,
          quantity,
          pallets,
          layers,
          warning_threshold,
          critical_threshold,
          max_quantity,
          unit_price,
          product_id,
          products(
            product_name,
            manufacturer_id,
            unit,
            feet_per_layer,
            layers_per_pallet,
            manufacturers(
              id,
              manufacturer_name
            )
          )
        `)
          .is("is_archived", false)
          .order("quantity", { ascending: true })

        if (productsError) throw productsError

        // Filter products with low stock in JavaScript
        const lowStockItems = productsData?.filter((item) => item.quantity < item.warning_threshold) || []

        // Extract unique manufacturer IDs from low stock items
        const manufacturerIds = lowStockItems.map((item) => item.products.manufacturers.id)
        const uniqueManufacturerIds = [...new Set(manufacturerIds)]

        // Create manufacturer objects directly from the low stock items
        const uniqueManufacturers = uniqueManufacturerIds
          .map((id) => {
            const item = lowStockItems.find((product) => product.products.manufacturers.id === id)
            return {
              id: id,
              manufacturer_name: item?.products.manufacturers.manufacturer_name || "",
            }
          })
          .sort((a, b) => a.manufacturer_name.localeCompare(b.manufacturer_name))

        setLowStockProducts(lowStockItems)
        setManufacturers(uniqueManufacturers)

        // If there are manufacturers and none is selected yet, select "all"
        if (uniqueManufacturers.length > 0 && !selectedManufacturer) {
          setSelectedManufacturer("all")
        }
      } catch (error: any) {
        console.error("Error fetching data:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load inventory data: " + error.message,
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [supabase, toast, selectedManufacturer])

  const filteredProducts =
    selectedManufacturer && selectedManufacturer !== "all"
      ? lowStockProducts.filter((product) => product.products.manufacturers.id === selectedManufacturer)
      : lowStockProducts

  // Function to generate a styled order name in the format PO-YYYYMMDD-XXXXXX-YYYYYY
  function generateStyledOrderName(): string {
    const now = new Date()
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "") // YYYYMMDD
    const firstRandomSuffix = Math.floor(100000 + Math.random() * 900000).toString() // 6-digit random number
    const secondRandomSuffix = Math.floor(10000 + Math.random() * 90000).toString() // 5-digit random number

    return `PO-${datePart}-${firstRandomSuffix}-${secondRandomSuffix}`
  }

  const handleCreatePurchaseOrder = async () => {
    if (!selectedManufacturer || selectedManufacturer === "all") {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a specific manufacturer to create a purchase order",
      })
      return
    }

    setIsUpdatingInventory(true)

    try {
      // Generate a properly formatted order name
      const orderName = generateStyledOrderName()

      // Create a new purchase order
      const { data: orderData, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          order_name: orderName,
          status: "Draft",
          delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 1 week from now
          manufacturer_id: selectedManufacturer,
          date_created: new Date().toISOString(),
          date_last_updated: new Date().toISOString(),
        })
        .select()

      if (orderError) throw orderError

      const purchaseOrderId = orderData[0].id

      // Get the products that need to be restocked for this manufacturer
      const productsToRestock = filteredProducts
        .map((variant) => {
          // Calculate quantity needed to reach max_quantity or double the warning threshold
          const orderQuantity = variant.max_quantity
            ? Math.max(variant.max_quantity - variant.quantity, 0)
            : variant.warning_threshold

          // Use the variant's unit price if available, otherwise default to 0
          const unitPrice = variant.unit_price || 0

          // Calculate the total order item value
          const totalOrderItemValue = unitPrice * orderQuantity

          return {
            purchase_order_id: purchaseOrderId,
            product_id: variant.product_id,
            variant_id: variant.id,
            quantity: orderQuantity,
            unit_price: unitPrice,
            total_order_item_value: totalOrderItemValue,
            date_created: new Date().toISOString(),
            date_last_updated: new Date().toISOString(),
          }
        })
        .filter((item) => item.quantity > 0) // Only include items that need restocking

      if (productsToRestock.length > 0) {
        // Add items to the purchase order
        const { error: itemsError } = await supabase.from("purchase_order_items").insert(productsToRestock)

        if (itemsError) throw itemsError
      }

      // Calculate and update the order totals
      const subtotal = productsToRestock.reduce((sum, item) => sum + item.total_order_item_value, 0)

      const { error: updateOrderError } = await supabase
        .from("purchase_orders")
        .update({
          subtotal_order_value: subtotal,
          total_order_value: subtotal, // Total is the same as subtotal for purchase orders
          date_last_updated: new Date().toISOString(),
        })
        .eq("id", purchaseOrderId)

      if (updateOrderError) throw updateOrderError

      // Update inventory levels for each product variant
      const inventoryUpdates = []
      const inventoryUpdateErrors = []

      for (const product of filteredProducts) {
        try {
          const orderQuantity = product.max_quantity
            ? Math.max(product.max_quantity - product.quantity, 0)
            : product.warning_threshold

          if (orderQuantity <= 0) continue

          const isSpecialUnit = product.products.unit === "Square Feet" || product.products.unit === "Linear Feet"
          const newQuantity = product.quantity + orderQuantity

          // Prepare the update object
          const updateData: any = {
            quantity: newQuantity,
            date_last_updated: new Date().toISOString(),
          }

          // If this is a special unit and we have the necessary data, update pallets and layers
          if (
            isSpecialUnit &&
            product.products.feet_per_layer &&
            product.products.layers_per_pallet &&
            product.pallets !== null &&
            product.layers !== null
          ) {
            const { pallets, layers } = quantityToPalletsAndLayers(
              newQuantity,
              product.products.feet_per_layer,
              product.products.layers_per_pallet,
            )
            updateData.pallets = pallets
            updateData.layers = layers
          }

          // Update the product variant
          const { error: updateError } = await supabase.from("product_variants").update(updateData).eq("id", product.id)

          if (updateError) {
            throw updateError
          }

          inventoryUpdates.push({
            id: product.id,
            name: product.product_variant_name,
            oldQuantity: product.quantity,
            newQuantity: newQuantity,
          })
        } catch (error: any) {
          console.error(`Error updating inventory for product ${product.id}:`, error)
          inventoryUpdateErrors.push({
            id: product.id,
            name: product.product_variant_name,
            error: error.message,
          })
        }
      }

      // Show success message with inventory update details
      toast({
        title: "Purchase Order Created",
        description: `Purchase order ${orderName} created with ${productsToRestock.length} items. Inventory updated for ${inventoryUpdates.length} products.`,
      })

      // If there were any errors updating inventory, show a warning
      if (inventoryUpdateErrors.length > 0) {
        toast({
          variant: "destructive",
          title: "Inventory Update Warning",
          description: `Failed to update inventory for ${inventoryUpdateErrors.length} products. See console for details.`,
        })
      }

      // Navigate to the new purchase order
      router.push(`/dashboard/purchase-orders/${purchaseOrderId}/edit`)
    } catch (error: any) {
      console.error("Error creating purchase order:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create purchase order: " + error.message,
      })
    } finally {
      setIsUpdatingInventory(false)
    }
  }

  const quantityToPalletsAndLayers = (
    quantity: number,
    feetPerLayer: number,
    layersPerPallet: number,
  ): { pallets: number; layers: number } => {
    const totalFeet = quantity
    const totalLayers = totalFeet / feetPerLayer
    const pallets = Math.floor(totalLayers / layersPerPallet)
    // Round up the remaining layers to the nearest whole number
    const remainingLayers = Math.ceil(totalLayers % layersPerPallet)

    // Handle the case where rounding up layers equals a full pallet
    if (remainingLayers === layersPerPallet) {
      return { pallets: pallets + 1, layers: 0 }
    }

    return { pallets, layers: remainingLayers }
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Low Stock Inventory Items
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by manufacturer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Manufacturers</SelectItem>
                {manufacturers.map((manufacturer) => (
                  <SelectItem key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.manufacturer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setIsConfirmDialogOpen(true)}
              disabled={!selectedManufacturer || selectedManufacturer === "all" || isUpdatingInventory}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Purchase Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p>Loading inventory data...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead className="text-right">Current Quantity</TableHead>
                  <TableHead className="text-right">Order Quantity</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const isCritical = product.quantity <= product.critical_threshold
                  const orderQuantity = product.max_quantity
                    ? Math.max(product.max_quantity - product.quantity, 0)
                    : product.warning_threshold
                  const isSpecialUnit =
                    product.products.unit === "Square Feet" || product.products.unit === "Linear Feet"

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        {isCritical ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Critical
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="flex items-center gap-1 bg-amber-500">
                            <AlertTriangle className="h-3 w-3" />
                            Warning
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{product.products.product_name}</TableCell>
                      <TableCell>{product.product_variant_name}</TableCell>
                      <TableCell>{product.product_variant_sku}</TableCell>
                      <TableCell>{product.products.manufacturers.manufacturer_name}</TableCell>
                      <TableCell className={`text-right ${isCritical ? "text-red-600 font-bold" : "text-amber-600"}`}>
                        <div>
                          {product.quantity} {product.products.unit}
                        </div>
                        {isSpecialUnit && product.pallets !== null && product.layers !== null && (
                          <div className="text-xs text-gray-500">
                            ({product.pallets} Pallets, {product.layers} Layers)
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          {orderQuantity} {product.products.unit}
                        </div>
                        {isSpecialUnit && product.products.feet_per_layer && product.products.layers_per_pallet && (
                          <div className="text-xs text-gray-500">
                            {(() => {
                              const { pallets, layers } = quantityToPalletsAndLayers(
                                orderQuantity,
                                product.products.feet_per_layer,
                                product.products.layers_per_pallet,
                              )
                              return `(${pallets} Pallets, ${layers} Layers)`
                            })()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.warning_threshold}/{product.critical_threshold}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {selectedManufacturer && selectedManufacturer !== "all"
                ? "No low stock items found for the selected manufacturer."
                : "All inventory items are above their warning thresholds. No action needed at this time."}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>Are you sure you want to create a purchase order for low stock items?</DialogDescription>
          </DialogHeader>
          <Alert className="my-4 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Important Information</AlertTitle>
            <AlertDescription className="text-blue-700">
              This will create a purchase order with all low stock items for the selected manufacturer. The inventory
              will be updated immediately with the ordered quantities. You will be able to review and edit the order
              before finalizing.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsConfirmDialogOpen(false)
                handleCreatePurchaseOrder()
              }}
              disabled={isUpdatingInventory}
            >
              {isUpdatingInventory ? "Processing..." : "Create Purchase Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
