"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { ArrowUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Manufacturer {
  id: string
  manufacturer_name: string
}

interface ProductVariant {
  id: string
  product_variant_name: string
  product_variant_sku: string
  quantity: number
  warning_threshold: number
  critical_threshold: number
  max_quantity: number | null
  product_id: string
  products: {
    product_name: string
    manufacturer_id: string
    manufacturers: {
      id: string
      manufacturer_name: string
    }
  }
}

export function OverMaxQuantityTable() {
  const [overMaxProducts, setOverMaxProducts] = useState<ProductVariant[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

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
            warning_threshold,
            critical_threshold,
            max_quantity,
            product_id,
            products(
              product_name,
              manufacturer_id,
              manufacturers(
                id,
                manufacturer_name
              )
            )
          `)
          .is("is_archived", false)
          .order("quantity", { ascending: false })

        if (productsError) throw productsError

        // Filter products exceeding max quantity
        const overMaxItems =
          productsData?.filter((item) => item.max_quantity !== null && item.quantity > item.max_quantity) || []

        // Fetch manufacturers
        const { data: manufacturersData, error: manufacturersError } = await supabase
          .from("manufacturers")
          .select("id, manufacturer_name")
          .is("is_archived", false)
          .order("manufacturer_name", { ascending: true })

        if (manufacturersError) throw manufacturersError

        setOverMaxProducts(overMaxItems)
        setManufacturers(manufacturersData || [])
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
  }, [supabase, toast])

  const filteredProducts =
    selectedManufacturer && selectedManufacturer !== "all"
      ? overMaxProducts.filter((product) => product.products.manufacturers.id === selectedManufacturer)
      : overMaxProducts

  // Calculate how much over max each product is (as a percentage)
  const calculateOveragePercentage = (quantity: number, maxQuantity: number | null) => {
    if (!maxQuantity || maxQuantity === 0) return 0
    return Math.round(((quantity - maxQuantity) / maxQuantity) * 100)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ArrowUp className="h-5 w-5 text-purple-600" />
          Inventory Exceeding Maximum Capacity
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
                <TableHead className="text-right">Max Quantity</TableHead>
                <TableHead className="text-right">Over By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const overagePercentage = calculateOveragePercentage(product.quantity, product.max_quantity)
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1 bg-purple-100 text-purple-800 border-purple-300"
                      >
                        <ArrowUp className="h-3 w-3" />
                        Over Max
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{product.products.product_name}</TableCell>
                    <TableCell>{product.product_variant_name}</TableCell>
                    <TableCell>{product.product_variant_sku}</TableCell>
                    <TableCell>{product.products.manufacturers.manufacturer_name}</TableCell>
                    <TableCell className="text-right font-bold text-purple-700">{product.quantity}</TableCell>
                    <TableCell className="text-right">{product.max_quantity}</TableCell>
                    <TableCell className="text-right font-medium">
                      {product.quantity - (product.max_quantity || 0)} ({overagePercentage}%)
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {selectedManufacturer && selectedManufacturer !== "all"
              ? "No items exceeding maximum quantity found for the selected manufacturer."
              : "All inventory items are within their maximum capacity limits."}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
