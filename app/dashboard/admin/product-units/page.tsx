import { getProductsWithMissingUnits } from "@/lib/data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import ProductUnitForm from "./product-unit-form"

export const metadata = {
  title: "Product Units Management",
}

export default async function ProductUnitsPage() {
  const productsWithMissingUnits = await getProductsWithMissingUnits()

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Product Units Management</h1>
        <Link href="/dashboard/products">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>

      {productsWithMissingUnits.length > 0 ? (
        <Card className="mb-8 border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-800">Products Missing Units</CardTitle>
            </div>
            <CardDescription className="text-amber-700">
              The following products have no unit defined. This will cause issues in order forms.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsWithMissingUnits.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.product_name}</TableCell>
                    <TableCell>{product.product_category}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/products/${product.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Edit Product
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">All Products Have Units Defined</CardTitle>
            <CardDescription className="text-green-700">
              All products in the database have units properly defined.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bulk Update Product Units</CardTitle>
          <CardDescription>
            Update units for multiple products at once based on their category or name pattern.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductUnitForm />
        </CardContent>
      </Card>
    </div>
  )
}
