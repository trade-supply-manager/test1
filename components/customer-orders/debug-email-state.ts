/**
 * Debug utility to log the state of email recipients
 */
export function debugEmailState(
  orderId: string,
  selectedContactIds: string[] = [],
  selectedEmployeeIds: string[] = [],
  includePrimaryContact = true,
  customerId?: string,
) {
  console.log("🔍 DEBUG EMAIL STATE")
  console.log("Order ID:", orderId)
  console.log("Customer ID:", customerId)
  console.log("Selected Contact IDs:", selectedContactIds)
  console.log("Selected Employee IDs:", selectedEmployeeIds)
  console.log("Include Primary Contact:", includePrimaryContact)

  // Check if arrays are actually arrays
  console.log("selectedContactIds is Array:", Array.isArray(selectedContactIds))
  console.log("selectedEmployeeIds is Array:", Array.isArray(selectedEmployeeIds))

  // Check if the arrays have the expected structure
  if (selectedContactIds && selectedContactIds.length > 0) {
    console.log("First contact ID:", selectedContactIds[0])
    console.log("Contact IDs type:", typeof selectedContactIds[0])
  }

  if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
    console.log("First employee ID:", selectedEmployeeIds[0])
    console.log("Employee IDs type:", typeof selectedEmployeeIds[0])
  }
}
