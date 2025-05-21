import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

/**
 * Fetches a customer by ID from the database
 */
export async function getCustomerById(id: string) {
  const supabase = createServerComponentClient({ cookies })
  const { data } = await supabase.from("customers").select("*").eq("id", id).single()
  return data
}

/**
 * Fetches all customers from the database
 */
export async function getAllCustomers() {
  const supabase = createServerComponentClient({ cookies })
  const { data } = await supabase.from("customers").select("*").order("customer_name", { ascending: true })
  return data || []
}

/**
 * Fetches application settings from the database
 */
export async function getAppSettings() {
  const supabase = createServerComponentClient({ cookies })
  const { data, error } = await supabase.from("app_settings").select("*").limit(1).single()

  if (error) {
    console.error("Error fetching app settings:", error)
    return null
  }

  return data
}

/**
 * Fetches a product by ID from the database with complete details
 */
export async function getProductById(id: string) {
  const supabase = createServerComponentClient({ cookies })
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      product_variants (*)
    `)
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching product:", error)
    return null
  }

  return data
}

/**
 * Updates a product's unit in the database
 */
export async function updateProductUnit(productId: string, unit: string) {
  const supabase = createServerComponentClient({ cookies })
  const { data, error } = await supabase.from("products").update({ unit }).eq("id", productId).select()

  if (error) {
    console.error("Error updating product unit:", error)
    throw new Error(`Failed to update product unit: ${error.message}`)
  }

  return data
}

/**
 * Fetches products with missing units
 */
export async function getProductsWithMissingUnits() {
  const supabase = createServerComponentClient({ cookies })
  const { data, error } = await supabase.from("products").select("id, product_name, product_category").is("unit", null)

  if (error) {
    console.error("Error fetching products with missing units:", error)
    return []
  }

  return data || []
}
