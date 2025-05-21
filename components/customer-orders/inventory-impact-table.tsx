import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, PlusCircle, MinusCircle } from "lucide-react"

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
  isTransient?: boolean // Flag to indicate if this item was added and deleted in the same session
}

interface InventoryImpactTableProps {
  inventoryChanges: InventoryChange[]
}

export function InventoryImpactTable({ inventoryChanges }: InventoryImpactTableProps) {
  // Filter out transient items (added and then deleted in the same session)
  const filteredChanges = inventoryChanges.filter((change) => {
    // Skip transient items
    if (change.isTransient) return false

    // Skip items with no change
    const hasNoChange =
      change.change_quantity === 0 &&
      (change.change_pallets === null || change.change_pallets === 0) &&
      (change.change_layers === null || change.change_layers === 0)

    return !hasNoChange
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Variant</TableHead>
          <TableHead>Current</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>New</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Update</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredChanges.length > 0 ? (
          filteredChanges.map((change) => {
            const isWarning = change.new_quantity < (change.warning_threshold || 0)
            const isCritical = change.new_quantity < (change.critical_threshold || 0)
            const isSpecialUnit = change.unit === "Square Feet" || change.unit === "Linear Feet"
            const isDeleted = change.is_deleted === true

            // Calculate new values directly from current + change
            const newQuantity =
              change.current_quantity +
              // If item is deleted OR has negative change_quantity (returned to inventory)
              (isDeleted || change.change_quantity < 0
                ? Math.abs(change.change_quantity) // Add to inventory
                : -Math.abs(change.change_quantity)) // Subtract from inventory

            // Calculate new pallets and layers using the spreadsheet formula approach
            let newPallets = change.current_pallets || 0
            let newLayers = change.current_layers || 0

            if (isSpecialUnit && change.feet_per_layer && change.layers_per_pallet) {
              // Calculate directly from the newQuantity value
              // Step 1: Calculate exact layers from quantity
              const exactLayers = newQuantity / change.feet_per_layer

              // Step 2: Calculate total layers with appropriate rounding (ceiling)
              const totalLayers = Math.ceil(exactLayers)

              // Step 3: Calculate pallets (floor division)
              newPallets = Math.floor(totalLayers / change.layers_per_pallet)

              // Step 4: Calculate remaining layers
              newLayers = totalLayers - newPallets * change.layers_per_pallet
            }

            // Determine if this item will be updated in the database
            const hasNoChange =
              change.change_quantity === 0 &&
              (change.change_pallets === null || change.change_pallets === 0) &&
              (change.change_layers === null || change.change_layers === 0)

            return (
              <TableRow
                key={change.variant_id + (isDeleted ? "-deleted" : "")}
                className={isDeleted ? "bg-green-50" : hasNoChange ? "bg-gray-50 opacity-70" : ""}
              >
                <TableCell className="font-medium">
                  {change.product_name}
                  {isSpecialUnit && change.feet_per_layer && change.layers_per_pallet && (
                    <span className="text-xs text-muted-foreground block">
                      {change.feet_per_layer} ft/layer, {change.layers_per_pallet} layers/pallet
                    </span>
                  )}
                </TableCell>
                <TableCell>{change.variant_name}</TableCell>
                <TableCell>
                  {change.current_quantity.toFixed(0)} {change.unit}
                  {isSpecialUnit && change.current_pallets !== null && change.current_layers !== null && (
                    <span className="text-xs text-muted-foreground block">
                      {change.current_pallets} Pallets and {change.current_layers} Layers
                    </span>
                  )}
                </TableCell>
                <TableCell className={isDeleted || change.change_quantity < 0 ? "text-green-600" : "text-red-500"}>
                  {isDeleted || change.change_quantity < 0 ? (
                    <div className="flex items-center">
                      <PlusCircle className="h-3 w-3 mr-1" />
                      {Math.abs(change.change_quantity).toFixed(0)} {change.unit}
                    </div>
                  ) : hasNoChange ? (
                    <div className="text-gray-400">No change</div>
                  ) : (
                    <div className="flex items-center">
                      <MinusCircle className="h-3 w-3 mr-1" />
                      {Math.abs(change.change_quantity).toFixed(0)} {change.unit}
                    </div>
                  )}
                  {isSpecialUnit && change.change_pallets !== null && change.change_layers !== null && !hasNoChange && (
                    <span className="text-xs text-muted-foreground block">
                      {isDeleted || change.change_quantity < 0 ? "+" : "-"}
                      {Math.abs(change.change_pallets || 0)} Pallets and {Math.abs(change.change_layers || 0)} Layers
                    </span>
                  )}
                  {isDeleted && (
                    <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded mt-1 inline-block">
                      Returned to inventory
                    </span>
                  )}
                  {!isDeleted && change.change_quantity < 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded mt-1 inline-block">
                      Returned to inventory
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {hasNoChange ? (
                    <span className="text-gray-400">-</span>
                  ) : (
                    <>
                      {newQuantity.toFixed(0)} {change.unit}
                      {isSpecialUnit && (
                        <span className="text-xs text-muted-foreground block">
                          {newPallets} Pallets and {newLayers} Layers
                        </span>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  {isCritical ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Critical
                    </Badge>
                  ) : isWarning ? (
                    <Badge variant="warning" className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Warning
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      OK
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {change.isTransient ? (
                    <Badge variant="outline" className="text-gray-400 border-gray-300">
                      Transient
                    </Badge>
                  ) : hasNoChange ? (
                    <Badge variant="outline" className="text-gray-400 border-gray-300">
                      No Change
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      Update
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })
        ) : (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
              No inventory changes to display. Add items to the order to see their impact on inventory.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
