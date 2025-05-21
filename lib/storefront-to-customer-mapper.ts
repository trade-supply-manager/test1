import { v4 as uuidv4 } from "uuid"

/**
 * Maps a storefront customer to a customer record
 */
export function mapStorefrontCustomerToCustomer(
  storefrontCustomer: any,
  userId: string | undefined,
  timestamp: string,
) {
  // Check if customer already exists with the same email
  // If so, return the existing customer ID
  // This would require a database check, which we'll implement in the API route

  return {
    id: uuidv4(), // Generate a new UUID for the customer
    customer_name: storefrontCustomer.customer_name,
    customer_type: storefrontCustomer.customer_type || "Retail", // Default to Retail if not specified
    email: storefrontCustomer.email,
    phone_number: storefrontCustomer.phone_number,
    address: storefrontCustomer.address,
    province_name: storefrontCustomer.province_name,
    city: storefrontCustomer.city,
    postal_code: storefrontCustomer.postal_code,
    date_created: timestamp,
    date_last_updated: timestamp,
    created_by_user_id: userId,
    updated_by_user_id: userId,
    is_archived: false,
  }
}

/**
 * Maps a storefront order to a customer order
 */
export function mapStorefrontOrderToCustomerOrder(
  storefrontOrder: any,
  customerId: string,
  userId: string | undefined,
  timestamp: string,
) {
  return {
    id: uuidv4(), // Generate a new UUID for the customer order
    order_name: storefrontOrder.order_name,
    customer_id: customerId,
    status: "Pending", // Always set status to Pending for converted orders
    payment_status: storefrontOrder.payment_status || "Unpaid",
    delivery_method: storefrontOrder.delivery_method || "Delivery",
    delivery_date: storefrontOrder.delivery_date,
    delivery_time: storefrontOrder.delivery_time || "09:00",
    delivery_address: storefrontOrder.delivery_address || storefrontOrder.shipping_address,
    delivery_instructions: storefrontOrder.delivery_instructions || "",
    notes: storefrontOrder.notes || "", // Leave notes blank if no input was added
    tax_rate: storefrontOrder.tax_rate || 13, // Default tax rate
    subtotal_order_value: storefrontOrder.subtotal_order_value || 0,
    total_order_value: storefrontOrder.total_order_value || 0,
    discount_percentage: storefrontOrder.discount_amount
      ? (storefrontOrder.discount_amount / storefrontOrder.subtotal_order_value) * 100
      : 0,
    amount_paid: storefrontOrder.amount_paid || 0,
    send_email: false, // Default to false for converted orders
    date_created: timestamp,
    date_last_updated: timestamp,
    created_by_user_id: userId,
    updated_by_user_id: userId,
    is_archived: false,
  }
}

/**
 * Maps storefront order items to customer order items
 */
export function mapStorefrontOrderItemsToCustomerOrderItems(
  storefrontOrderItems: any[],
  customerOrderId: string,
  userId: string | undefined,
  timestamp: string,
) {
  return storefrontOrderItems.map((item) => ({
    customer_order_item_id: uuidv4(), // Generate a new UUID for each item
    customer_order_id: customerOrderId,
    product_id: item.product_id,
    variant_id: item.variant_id,
    unit_price: item.unit_price,
    quantity: item.quantity,
    discount_percentage: 0, // Default to 0 for converted items
    discount: 0, // Default to 0 for converted items
    total_order_item_value: item.total_price,
    is_pallet: false, // Default to false for converted items
    pallets: 0, // Default to 0 for converted items
    layers: 0, // Default to 0 for converted items
    date_created: timestamp,
    date_last_updated: timestamp,
    created_by_user_id: userId,
    updated_by_user_id: userId,
    is_archived: false,
  }))
}
