import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseRouteHandler } from "@/lib/supabase-route-handler"
import { v4 as uuidv4 } from "uuid"
import { withErrorHandling } from "@/lib/api-route-wrapper"

async function convertToCustomerOrderHandler(request: NextRequest, { params }: { params: { id: string } }) {
  console.log("Convert to customer order API called for order ID:", params.id)

  try {
    // Parse request body to get notes and selected customer ID
    const requestData = await request.json().catch(() => ({}))
    const { notes, selectedCustomerId } = requestData || {}

    console.log("Request data:", { notes, selectedCustomerId })

    const supabase = getSupabaseRouteHandler()

    // Fetch the storefront order with all related data
    const { data: storefrontOrder, error: orderError } = await supabase
      .from("storefront_orders")
      .select(`
        *,
        storefront_customers!customer_id(*),
        storefront_order_items!order_id(*)
      `)
      .eq("id", params.id)
      .single()

    if (orderError || !storefrontOrder) {
      console.error("Error fetching storefront order:", orderError)
      return NextResponse.json({ error: "Storefront order not found", details: orderError }, { status: 404 })
    }

    // Get current user ID for tracking
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id
    const timestamp = new Date().toISOString()

    // Step 1: Use selected customer or check if customer already exists or create a new one
    let customerId: string

    if (selectedCustomerId) {
      // Use the selected customer ID from the dropdown
      console.log("Using selected customer ID:", selectedCustomerId)
      customerId = selectedCustomerId

      // Verify the customer exists
      const { data: customerExists, error: customerCheckError } = await supabase
        .from("customers")
        .select("id")
        .eq("id", selectedCustomerId)
        .single()

      if (customerCheckError || !customerExists) {
        console.error("Selected customer not found:", customerCheckError)
        return NextResponse.json(
          {
            error: "Selected customer not found",
            details: customerCheckError,
          },
          { status: 404 },
        )
      }
    } else {
      // Check if customer already exists with the same email
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("email", storefrontOrder.storefront_customers.email)
        .maybeSingle()

      if (existingCustomer) {
        // Use existing customer
        customerId = existingCustomer.id
        console.log("Using existing customer with matching email:", customerId)
      } else {
        // Create new customer from storefront customer data
        const newCustomerId = uuidv4()
        console.log("Creating new customer:", newCustomerId)

        const { error: customerError } = await supabase.from("customers").insert({
          id: newCustomerId,
          customer_name: storefrontOrder.storefront_customers.customer_name,
          email: storefrontOrder.storefront_customers.email,
          phone_number: storefrontOrder.storefront_customers.phone_number,
          address: storefrontOrder.storefront_customers.address,
          city: storefrontOrder.storefront_customers.city,
          province_name: storefrontOrder.storefront_customers.province_name,
          postal_code: storefrontOrder.storefront_customers.postal_code,
          customer_type: storefrontOrder.storefront_customers.customer_type || "Retail",
          date_created: timestamp,
          date_last_updated: timestamp,
          created_by_user_id: userId,
          updated_by_user_id: userId,
          is_archived: false,
        })

        if (customerError) {
          console.error("Error creating customer:", customerError)
          return NextResponse.json(
            {
              error: "Failed to create customer",
              details: customerError,
            },
            { status: 500 },
          )
        }

        customerId = newCustomerId
      }
    }

    // Step 2: Create the customer order
    const customerOrderId = uuidv4()
    console.log("Creating customer order:", customerOrderId, "for customer:", customerId)

    const orderName =
      storefrontOrder.order_name ||
      `CO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`

    // Calculate discount percentage if discount_amount exists
    let discountPercentage = 0
    if (storefrontOrder.discount_amount && storefrontOrder.subtotal_order_value) {
      discountPercentage = (storefrontOrder.discount_amount / storefrontOrder.subtotal_order_value) * 100
    }

    // Map all available fields from storefront_order to customer_order
    const { error: createOrderError } = await supabase.from("customer_orders").insert({
      id: customerOrderId,
      customer_id: customerId,
      order_name: orderName,
      status: storefrontOrder.status || "Processing",
      payment_status: storefrontOrder.payment_status || "Unpaid",
      delivery_method: storefrontOrder.delivery_method || "Delivery",
      delivery_date: storefrontOrder.delivery_date,
      delivery_time: storefrontOrder.delivery_time || "09:00",
      delivery_address: storefrontOrder.delivery_address || storefrontOrder.storefront_customers.address,
      delivery_instructions: storefrontOrder.delivery_instructions || "",
      notes: notes || "", // Use provided notes or empty string
      tax_rate: storefrontOrder.tax_rate || 13,
      amount_paid: storefrontOrder.amount_paid || 0,
      subtotal_order_value: storefrontOrder.subtotal_order_value || 0,
      total_order_value: storefrontOrder.total_order_value || 0,
      discount_percentage: discountPercentage,
      send_email: false, // Don't automatically send email for converted orders
      date_created: timestamp,
      date_last_updated: timestamp,
      created_by_user_id: userId || storefrontOrder.created_by_user_id,
      updated_by_user_id: userId || storefrontOrder.updated_by_user_id,
      is_archived: false,
    })

    if (createOrderError) {
      console.error("Error creating customer order:", createOrderError)
      return NextResponse.json(
        {
          error: "Failed to create customer order",
          details: createOrderError,
        },
        { status: 500 },
      )
    }

    // Step 3: Create customer order items
    const orderItems = storefrontOrder.storefront_order_items || []
    const itemErrors = []

    for (const item of orderItems) {
      if (item.is_archived) continue // Skip archived items

      const orderItemId = uuidv4()

      // Calculate discount values (default to 0)
      const unitPrice = item.unit_price || 0
      const quantity = item.quantity || 0
      const discount = 0 // Default to no discount
      const totalOrderItemValue = unitPrice * quantity

      const { error: itemError } = await supabase.from("customer_order_items").insert({
        customer_order_item_id: orderItemId,
        customer_order_id: customerOrderId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        unit_price: unitPrice,
        quantity: quantity,
        discount_percentage: 0, // Default to no discount
        discount: discount,
        total_order_item_value: totalOrderItemValue,
        is_pallet: false, // Default value
        pallets: 0, // Default value
        layers: 0, // Default value
        date_created: timestamp,
        date_last_updated: timestamp,
        created_by_user_id: userId,
        updated_by_user_id: userId,
        is_archived: false,
      })

      if (itemError) {
        console.error("Error creating order item:", itemError)
        itemErrors.push(itemError)
        // Continue with other items even if one fails
      }
    }

    // Step 4: Update the storefront order to indicate it's been converted
    await supabase
      .from("storefront_orders")
      .update({
        notes: `${storefrontOrder.notes ? storefrontOrder.notes + ". " : ""}Converted to customer order ID: ${customerOrderId}`,
        date_last_updated: timestamp,
        updated_by_user_id: userId,
      })
      .eq("id", params.id)

    // Step 5: Log the conversion in storefront_order_logs if the table exists
    try {
      const { data: tableExists } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_name", "storefront_order_logs")
        .eq("table_schema", "public")

      if (tableExists && tableExists.length > 0) {
        await supabase.from("storefront_order_logs").insert({
          order_id: params.id,
          action: "convert",
          notes: `Converted to customer order ID: ${customerOrderId}`,
          created_at: timestamp,
        })
      }
    } catch (logError) {
      console.error("Error logging conversion:", logError)
      // Don't fail the request if logging fails
    }

    console.log("Order conversion completed successfully")
    return NextResponse.json({
      success: true,
      message: "Order converted to customer order successfully",
      customerOrderId: customerOrderId,
      itemErrors: itemErrors.length > 0 ? itemErrors : undefined,
    })
  } catch (error) {
    console.error("Error converting order:", error)
    return NextResponse.json({ error: "An unexpected error occurred", details: error }, { status: 500 })
  }
}

// Export the wrapped handler
export const POST = withErrorHandling(convertToCustomerOrderHandler)
