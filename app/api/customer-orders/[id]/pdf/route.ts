import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { generateOrderPdf } from "@/lib/pdf/generate-order-pdf"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  console.log(`📄 PDF API: Received request for order ID: ${params.id}`)

  try {
    // Validate the order ID
    const orderId = params.id
    if (!orderId || typeof orderId !== "string") {
      console.error(`❌ PDF API: Invalid order ID: ${orderId}`)
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(orderId)) {
      console.error(`❌ PDF API: Invalid order ID format: ${orderId}`)
      return NextResponse.json({ error: "Invalid order ID format" }, { status: 400 })
    }

    console.log(`📄 PDF API: Fetching order data for ID: ${orderId}`)

    // Get Supabase client
    const supabase = getSupabaseServer()

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("customer_orders")
      .select(`
        *,
        customers (
          id,
          customer_name,
          email,
          phone_number,
          address
        )
      `)
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      console.error(`❌ PDF API: Error fetching order:`, orderError)
      return NextResponse.json(
        { error: orderError ? orderError.message : "Order not found" },
        { status: orderError ? 500 : 404 },
      )
    }

    console.log(`📄 PDF API: Order found: ${order.order_name}`)

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
      .eq("customer_order_id", orderId)
      .eq("is_archived", false)

    if (itemsError) {
      console.error(`❌ PDF API: Error fetching order items:`, itemsError)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    console.log(`📄 PDF API: Found ${orderItems.length} order items`)

    // Fetch app settings
    const { data: appSettings, error: appSettingsError } = await supabase
      .from("app_settings")
      .select("pdf_header_text, pdf_logo_url")
      .single()

    if (appSettingsError) {
      console.warn(`⚠️ PDF API: Error fetching app settings:`, appSettingsError)
      // Continue without app settings
    }

    // Fetch company settings as fallback
    const { data: companySettings, error: companySettingsError } = await supabase
      .from("settings")
      .select("company_name, storefront_image")
      .single()

    if (companySettingsError) {
      console.warn(`⚠️ PDF API: Error fetching company settings:`, companySettingsError)
      // Continue without company settings
    }

    // Combine settings from both sources
    const combinedSettings = {
      ...companySettings,
      ...appSettings,
    }

    console.log(`📄 PDF API: Settings for PDF generation:`, {
      hasAppSettings: !!appSettings,
      hasCompanySettings: !!companySettings,
      combinedKeys: Object.keys(combinedSettings || {}),
      logoUrl: combinedSettings?.pdf_logo_url || combinedSettings?.storefront_image || "none",
      headerText: combinedSettings?.pdf_header_text || combinedSettings?.company_name || "default",
    })

    // Prepare data for PDF generation
    const pdfData = {
      order,
      orderItems,
      settings: combinedSettings || {
        pdf_header_text: "Trade Supply Manager",
        pdf_logo_url: null,
      },
    }

    console.log(`📄 PDF API: Generating PDF for order: ${order.order_name}`)

    // Generate PDF
    const pdfBuffer = await generateOrderPdf(pdfData)

    // Check if PDF generation was successful
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error(`❌ PDF API: PDF generation failed - empty buffer`)
      return NextResponse.json({ error: "PDF generation failed" }, { status: 500 })
    }

    console.log(`📄 PDF API: PDF generated successfully, size: ${pdfBuffer.length} bytes`)

    // Return the PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Order_${order.order_name}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error(`❌ PDF API: Unexpected error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}
