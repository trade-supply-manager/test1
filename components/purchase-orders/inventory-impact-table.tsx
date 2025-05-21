import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, PlusCircle, MinusCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

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
  isTransient?: boolean // Flag to indicate if this item was added and then deleted in the same session
}

interface InventoryImpactTableProps {
  inventoryChanges: InventoryChange[]
}

export function InventoryImpactTable({ inventoryChanges }: InventoryImpactTableProps) {
  // Filter out transient items
  const filteredChanges = inventoryChanges.filter((change) => !change.isTransient)

  if (filteredChanges.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold">Inventory Impact</CardTitle>
          <CardDescription>Review the changes to inventory levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No inventory changes to display.</p>
            <p className="text-sm mt-2">Add items to the order to see their impact on inventory.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold">Inventory Impact</CardTitle>
        <CardDescription>Review the changes to inventory levels</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-t border-b">
              <TableHead className="text-muted-foreground">Product</TableHead>
              <TableHead className="text-muted-foreground">Variant</TableHead>
              <TableHead className="text-muted-foreground">Current</TableHead>
              <TableHead className="text-muted-foreground">Change</TableHead>
              <TableHead className="text-muted-foreground">New</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChanges
              .filter((change) => {
                // Skip rows with no change
                const hasNoChange =
                  change.change_quantity === 0 &&
                  (change.change_pallets === null || change.change_pallets === 0) &&
                  (change.change_layers === null || change.change_layers === 0)
                return !hasNoChange
              })
              .map((change) => {
                const isWarning = change.new_quantity < (change.warning_threshold || 0)
                const isCritical = change.new_quantity < (change.critical_threshold || 0)
                const isSpecialUnit = change.unit === "Square Feet" || change.unit === "Linear Feet"
                const isDeleted = change.is_deleted === true

                // Calculate new values directly from current + change
                const newQuantity =
                  change.current_quantity + (isDeleted ? Math.abs(change.change_quantity) : change.change_quantity)

                // Calculate new pallets and layers using the spreadsheet formula approach
                let newPallets = change.current_pallets || 0
                let newLayers = change.current_layers || 0

                if (isSpecialUnit && change.feet_per_layer && change.layers_per_pallet) {
                  // Convert current inventory to total layers
                  const currentTotalLayers =
                    (change.current_pallets || 0) * change.layers_per_pallet + (change.current_layers || 0)

                  // Calculate change in total layers
                  const changeInLayers = isDeleted
                    ? Math.abs(change.change_pallets || 0) * change.layers_per_pallet +
                      Math.abs(change.change_layers || 0)
                    : (change.change_pallets || 0) * change.layers_per_pallet + (change.change_layers || 0)

                  // Calculate new total layers
                  const newTotalLayers = currentTotalLayers + changeInLayers

                  // Convert back to pallets and layers
                  newPallets = Math.floor(newTotalLayers / change.layers_per_pallet)
                  newLayers = newTotalLayers % change.layers_per_pallet
                }

                // Determine if this item will be updated in the database
                const hasNoChange =
                  change.change_quantity === 0 &&
                  (change.change_pallets === null || change.change_pallets === 0) &&
                  (change.change_layers === null || change.change_layers === 0)

                const isTransient = change.isTransient === true
                const willUpdate = !hasNoChange && !isTransient

                return (
                  <TableRow
                    key={change.variant_id + (isDeleted ? "-deleted" : "")}
                    className={isDeleted ? "bg-green-50" : hasNoChange ? "opacity-70" : ""}
                  >
                    <TableCell className="font-medium">
                      {change.product_name}
                      {isSpecialUnit && change.feet_per_layer && change.layers_per_pallet && (
                        <div className="text-xs text-gray-400">
                          {change.feet_per_layer} ft/layer, {change.layers_per_pallet} layers/pallet
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{change.variant_name}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {change.current_quantity.toFixed(0)} {change.unit}
                      </div>
                      {isSpecialUnit && change.current_pallets !== null && change.current_layers !== null && (
                        <div className="text-xs text-gray-400">
                          {change.current_pallets} Pallets and {change.current_layers} Layers
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isDeleted ? (
                        <div className="flex items-center text-red-500">
                          <MinusCircle className="h-3 w-3 mr-1" />
                          <span className="font-medium">
                            {Math.abs(change.change_quantity).toFixed(0)} {change.unit}
                          </span>
                        </div>
                      ) : hasNoChange ? (
                        <div className="text-gray-400">No change</div>
                      ) : (
                        <div className="flex items-center text-green-600">
                          <PlusCircle className="h-3 w-3 mr-1" />
                          <span className="font-medium">
                            {Math.abs(change.change_quantity).toFixed(0)} {change.unit}
                          </span>
                        </div>
                      )}
                      {isSpecialUnit &&
                        change.change_pallets !== null &&
                        change.change_layers !== null &&
                        !hasNoChange && (
                          <div className="text-xs text-gray-400">
                            {Math.abs(change.change_pallets)} Pallets and {Math.abs(change.change_layers)} Layers
                          </div>
                        )}
                      {isDeleted && (
                        <span className="text-xs bg-red-100 text-red-700 px-1 py-0.5 rounded mt-1 inline-block">
                          Removed from inventory
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasNoChange ? (
                        <span className="text-gray-400">-</span>
                      ) : (
                        <>
                          <div className="font-medium">
                            {newQuantity.toFixed(0)} {change.unit}
                          </div>
                          {isSpecialUnit && (
                            <div className="text-xs text-gray-400">
                              {newPallets} Pallets and {newLayers} Layers
                            </div>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {isCritical ? (
                        <Badge variant="destructive" className="flex items-center gap-1 px-3 py-1 rounded-full">
                          <AlertTriangle className="h-3 w-3" />
                          Critical
                        </Badge>
                      ) : isWarning ? (
                        <Badge
                          variant="warning"
                          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-full"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Warning
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600 px-3 py-1 rounded-full">
                          OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isTransient ? (
                        <Badge variant="outline" className="text-gray-400 border-gray-300">
                          Transient
                        </Badge>
                      ) : hasNoChange ? (
                        <Badge variant="outline" className="text-gray-400 border-gray-300">
                          No Change
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-600 border-blue-600">
                          Will Update
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
