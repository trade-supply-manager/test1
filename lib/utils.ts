import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Invalid Date"
  }
}

/**
 * Validates if a string is a properly formatted email address
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Converts quantity to pallets and layers based on product specifications
 * Handles both positive and negative inventory values consistently
 *
 * @param quantity - The quantity in the product's unit (e.g., Square Feet)
 * @param feetPerLayer - How many feet are in one layer
 * @param layersPerPallet - How many layers are in one pallet
 * @returns Object containing calculated pallets and layers
 */
export function quantityToPalletsAndLayers(
  quantity: number,
  feetPerLayer: number,
  layersPerPallet: number,
): { pallets: number; layers: number } {
  // Calculate exact layers from quantity
  const exactLayers = quantity / feetPerLayer

  // Calculate total layers with appropriate rounding
  // Use ceiling for positive quantities, floor for negative quantities
  const totalLayers = quantity >= 0 ? Math.ceil(exactLayers) : Math.floor(exactLayers)

  // Calculate pallets with floor division
  const pallets = Math.floor(totalLayers / layersPerPallet)

  // Calculate remaining layers
  let layers = totalLayers - pallets * layersPerPallet

  // Handle the special case for negative inventory
  // When pallets < 0, layers must be ≤ 0 to maintain logical constraints
  if (pallets < 0 && layers > 0) {
    layers = layers - layersPerPallet
    // Note: we don't adjust pallets here because the calculation already accounts for this
  }

  return { pallets, layers }
}

/**
 * Converts pallets and layers to quantity based on product specifications
 *
 * @param pallets - Number of pallets
 * @param layers - Number of layers
 * @param feetPerLayer - How many feet are in one layer
 * @param layersPerPallet - How many layers are in one pallet
 * @returns The calculated quantity in the product's unit (e.g., Square Feet)
 */
export function palletsAndLayersToQuantity(
  pallets: number,
  layers: number,
  feetPerLayer: number,
  layersPerPallet: number,
): number {
  // Calculate total layers
  const totalLayers = pallets * layersPerPallet + layers

  // Convert total layers to quantity
  const quantity = totalLayers * feetPerLayer

  return quantity
}

/**
 * Calculates new inventory levels when adding or removing inventory
 * Handles both positive and negative inventory changes
 *
 * @param currentPallets - Current number of pallets in inventory
 * @param currentLayers - Current number of layers in inventory
 * @param changePallets - Change in pallets (positive for additions, negative for removals)
 * @param changeLayers - Change in layers (positive for additions, negative for removals)
 * @param layersPerPallet - How many layers are in one pallet
 * @returns Object containing new pallets and layers after the inventory change
 */
export function calculateNewInventoryLevels(
  currentPallets: number,
  currentLayers: number,
  changePallets: number,
  changeLayers: number,
  layersPerPallet: number,
): { newPallets: number; newLayers: number } {
  // Calculate current inventory in total layers
  const currentTotalLayers = currentPallets * layersPerPallet + currentLayers

  // Calculate change in total layers
  const changeTotalLayers = changePallets * layersPerPallet + changeLayers

  // Calculate new total layers
  const newTotalLayers = currentTotalLayers + changeTotalLayers

  // Convert back to pallets and layers
  let newPallets = Math.floor(newTotalLayers / layersPerPallet)
  let newLayers = newTotalLayers - newPallets * layersPerPallet

  // Handle the special case for negative inventory
  // When pallets < 0, layers must be ≤ 0 to maintain logical constraints
  if (newPallets < 0 && newLayers > 0) {
    newLayers = newLayers - layersPerPallet
    newPallets += 1 // Still negative, but one closer to zero
  }

  return { newPallets, newLayers }
}

/**
 * Comprehensive inventory calculation function that handles all inventory operations
 * Can be used for both adding and removing inventory, and for converting between different units
 *
 * @param operation - The type of operation to perform ('quantityToPalletsLayers', 'palletsLayersToQuantity', or 'calculateNewLevels')
 * @param params - Parameters specific to the operation type
 * @returns The result of the calculation based on the operation type
 */
export function inventoryCalculator(
  operation: "quantityToPalletsLayers" | "palletsLayersToQuantity" | "calculateNewLevels",
  params: any,
): any {
  switch (operation) {
    case "quantityToPalletsLayers":
      return quantityToPalletsAndLayers(params.quantity, params.feetPerLayer, params.layersPerPallet)

    case "palletsLayersToQuantity":
      return palletsAndLayersToQuantity(params.pallets, params.layers, params.feetPerLayer, params.layersPerPallet)

    case "calculateNewLevels":
      return calculateNewInventoryLevels(
        params.currentPallets,
        params.currentLayers,
        params.changePallets,
        params.changeLayers,
        params.layersPerPallet,
      )

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

/**
 * Calculates inventory impact when adding or removing items
 * Handles both quantity-based and pallets/layers-based changes
 *
 * @param currentQuantity - Current quantity in inventory
 * @param currentPallets - Current number of pallets in inventory
 * @param currentLayers - Current number of layers in inventory
 * @param changeQuantity - Change in quantity (positive for additions, negative for removals)
 * @param changePallets - Change in pallets (or null if using quantity-based change)
 * @param changeLayers - Change in layers (or null if using quantity-based change)
 * @param feetPerLayer - How many feet are in one layer
 * @param layersPerPallet - How many layers are in one pallet
 * @param isUsingPalletsLayers - Whether the change is specified in pallets/layers (true) or quantity (false)
 * @returns Object containing new quantity, pallets, and layers after the inventory change
 */
export function calculateInventoryImpact(
  currentQuantity: number,
  currentPallets: number,
  currentLayers: number,
  changeQuantity: number,
  changePallets: number | null,
  changeLayers: number | null,
  feetPerLayer: number,
  layersPerPallet: number,
  isUsingPalletsLayers: boolean,
): { newQuantity: number; newPallets: number; newLayers: number } {
  // If using pallets/layers for the change
  if (isUsingPalletsLayers && changePallets !== null && changeLayers !== null) {
    // Calculate new inventory levels
    const { newPallets, newLayers } = calculateNewInventoryLevels(
      currentPallets,
      currentLayers,
      changePallets,
      changeLayers,
      layersPerPallet,
    )

    // Calculate new quantity based on new pallets and layers
    const newQuantity = palletsAndLayersToQuantity(newPallets, newLayers, feetPerLayer, layersPerPallet)

    return { newQuantity, newPallets, newLayers }
  }
  // If using quantity for the change
  else {
    // Calculate current quantity if not provided accurately
    const calculatedCurrentQuantity = palletsAndLayersToQuantity(
      currentPallets,
      currentLayers,
      feetPerLayer,
      layersPerPallet,
    )

    // Use calculated current quantity if it differs significantly from provided current quantity
    const effectiveCurrentQuantity =
      Math.abs(calculatedCurrentQuantity - currentQuantity) < 0.01 ? currentQuantity : calculatedCurrentQuantity

    // Calculate new quantity
    const newQuantity = effectiveCurrentQuantity + changeQuantity

    // Convert new quantity to pallets and layers
    const { pallets: newPallets, layers: newLayers } = quantityToPalletsAndLayers(
      newQuantity,
      feetPerLayer,
      layersPerPallet,
    )

    return { newQuantity, newPallets, newLayers }
  }
}
