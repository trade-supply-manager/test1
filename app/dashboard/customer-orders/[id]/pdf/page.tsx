import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { CustomerOrderPDF } from "@/components/customer-orders/customer-order-pdf"
import { log, LogLevel } from "@/lib/debug-utils"

export default async function CustomerOrderPDFPage({ params }: { params: { id: string } }) {
  console.log(`📄 CustomerOrderPDFPage: Rendering PDF page for order ID: ${params.id}`)

  const supabase = createServerComponentClient({ cookies })

  // Fetch the order data
  const { data: order, error: orderError } = await supabase
    .from("customer_orders")
    .select(`
      *,
      customers (
        customer_name,
        email,
        phone_number,
        address
      )
    `)
    .eq("id", params.id)
    .single()

  if (orderError || !order) {
    console.error(`❌ CustomerOrderPDFPage: Error fetching order:`, orderError)
    log(LogLevel.ERROR, "CustomerOrderPDFPage", "Error fetching order", {
      orderId: params.id,
      error: orderError?.message,
    })
    notFound()
  }

  console.log(`📄 CustomerOrderPDFPage: Order found: ${order.order_name}`)

  // Fetch order items
  const { data: orderItems, error: itemsError } = await supabase
    .from("customer_order_items")
    .select(`
      *,
      products (
        product_name,
        unit
      ),
      product_variants (
        product_variant_name,
        product_variant_sku
      )
    `)
    .eq("customer_order_id", params.id)
    .eq("is_archived", false)

  if (itemsError) {
    console.error(`❌ CustomerOrderPDFPage: Error fetching order items:`, itemsError)
    log(LogLevel.ERROR, "CustomerOrderPDFPage", "Error fetching order items", {
      orderId: params.id,
      error: itemsError?.message,
    })
    notFound()
  }

  console.log(`📄 CustomerOrderPDFPage: Found ${orderItems?.length || 0} order items`)

  // Fetch app settings
  const { data: appSettings, error: settingsError } = await supabase
    .from("app_settings")
    .select("pdf_header_text, pdf_logo_url")
    .limit(1)
    .single()

  if (settingsError) {
    console.warn(`⚠️ CustomerOrderPDFPage: Error fetching app settings:`, settingsError)
    log(LogLevel.WARN, "CustomerOrderPDFPage", "Error fetching app settings", {
      error: settingsError?.message,
    })
    // Continue without settings
  }

  // Also fetch company settings as fallback
  const { data: companySettings, error: companySettingsError } = await supabase
    .from("settings")
    .select("company_name, storefront_image")
    .limit(1)
    .single()

  if (companySettingsError) {
    console.warn(`⚠️ CustomerOrderPDFPage: Error fetching company settings:`, companySettingsError)
    log(LogLevel.WARN, "CustomerOrderPDFPage", "Error fetching company settings", {
      error: companySettingsError?.message,
    })
    // Continue without company settings
  }

  // Combine settings from both sources
  const combinedSettings = {
    ...companySettings,
    ...appSettings,
  }

  console.log(`📄 CustomerOrderPDFPage: Settings for PDF generation:`, {
    hasAppSettings: !!appSettings,
    hasCompanySettings: !!companySettings,
    combinedKeys: Object.keys(combinedSettings || {}),
    logoUrl: combinedSettings?.pdf_logo_url || combinedSettings?.storefront_image || "none",
    headerText: combinedSettings?.pdf_header_text || combinedSettings?.company_name || "default",
  })

  return (
    <div className="container mx-auto py-6">
      <CustomerOrderPDF order={order} orderItems={orderItems || []} settings={combinedSettings || undefined} />
    </div>
  )
}
