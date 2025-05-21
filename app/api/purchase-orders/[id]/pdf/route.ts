import { type NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { generatePurchaseOrderPdf } from "@/lib/pdf/generate-purchase-order-pdf"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Fetch the order data
    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        manufacturers (
          manufacturer_name,
          email,
          phone_number,
          address
        )
      `)
      .eq("id", params.id)
      .single()

    if (orderError || !order) {
      console.error("Error fetching order:", orderError)
      return new NextResponse(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Fetch order items
    const { data: orderItems, error: itemsError } = await supabase
      .from("purchase_order_items")
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
      .eq("purchase_order_id", params.id)
      .eq("is_archived", false)

    if (itemsError) {
      console.error("Error fetching order items:", itemsError)
      return new NextResponse(JSON.stringify({ error: "Failed to fetch order items" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Fetch app settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("pdf_header_text, pdf_logo_url")
      .limit(1)
      .single()

    // Generate PDF
    const pdfBuffer = await generatePurchaseOrderPdf({
      order,
      orderItems: orderItems || [],
      settings: settings || undefined,
    })

    // Return the PDF as a downloadable file
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="purchase_order_${order.order_name}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error("Error generating PDF:", error)
    return new NextResponse(JSON.stringify({ error: error.message || "Failed to generate PDF" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
