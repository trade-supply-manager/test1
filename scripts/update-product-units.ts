import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateProductUnits() {
  console.log("Starting product unit update...")

  // Update Citadin products to use Square Feet
  const { data: citadinProducts, error: citadinError } = await supabase
    .from("products")
    .update({ unit: "Square Feet" })
    .like("product_name", "%Citadin%")
    .select("id, product_name, unit")

  if (citadinError) {
    console.error("Error updating Citadin products:", citadinError)
  } else {
    console.log(`Updated ${citadinProducts.length} Citadin products:`, citadinProducts)
  }

  // Update specific product by ID if needed
  const specificProductId = "YOUR_CITADIN_PRODUCT_ID" // Replace with actual ID from debug info
  if (specificProductId !== "YOUR_CITADIN_PRODUCT_ID") {
    const { data: specificProduct, error: specificError } = await supabase
      .from("products")
      .update({ unit: "Square Feet" })
      .eq("id", specificProductId)
      .select("id, product_name, unit")

    if (specificError) {
      console.error("Error updating specific product:", specificError)
    } else {
      console.log("Updated specific product:", specificProduct)
    }
  }

  // Set default units for other product categories
  const productUpdates = [
    { pattern: "%Slab%", unit: "Square Feet" },
    { pattern: "%Paver%", unit: "Square Feet" },
    { pattern: "%Stone%", unit: "Square Feet" },
    { pattern: "%Wall%", unit: "Square Feet" },
    { pattern: "%Step%", unit: "Linear Feet" },
    { pattern: "%Coping%", unit: "Linear Feet" },
  ]

  for (const update of productUpdates) {
    const { data: products, error } = await supabase
      .from("products")
      .update({ unit: update.unit })
      .like("product_name", update.pattern)
      .is("unit", null) // Only update products with null unit
      .select("id, product_name, unit")

    if (error) {
      console.error(`Error updating ${update.pattern} products:`, error)
    } else {
      console.log(`Updated ${products.length} ${update.pattern} products to ${update.unit}`)
    }
  }

  // Verify all products now have units
  const { data: productsWithoutUnits, error: verifyError } = await supabase
    .from("products")
    .select("id, product_name")
    .is("unit", null)

  if (verifyError) {
    console.error("Error verifying products:", verifyError)
  } else if (productsWithoutUnits && productsWithoutUnits.length > 0) {
    console.warn(`${productsWithoutUnits.length} products still have no unit defined:`, productsWithoutUnits)
  } else {
    console.log("All products now have units defined!")
  }
}

// Run the update
updateProductUnits()
  .then(() => console.log("Product unit update completed"))
  .catch((err) => console.error("Error in product unit update:", err))
  .finally(() => process.exit(0))
