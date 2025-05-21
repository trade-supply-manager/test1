import { formatCurrency } from "@/lib/utils"

interface OrderItem {
  name: string
  sku: string
  quantity: number
  unit: string | null
  unitPrice: number
  total: number
}

interface OrderDetails {
  orderNumber: string
  orderDate: string
  deliveryDate: string
  deliveryTime: string
  customerName: string
  customerEmail: string
  customerPhone: string
  deliveryAddress?: string
  deliveryInstructions?: string
  subtotal: number
  tax: number
  total: number
  items: OrderItem[]
  headerImageUrl?: string | null
}

/**
 * Generate HTML email template for order confirmation
 */
export function orderConfirmationTemplate(order: OrderDetails): string {
  const {
    orderNumber,
    orderDate,
    deliveryDate,
    deliveryTime,
    customerName,
    customerEmail,
    customerPhone,
    deliveryAddress,
    deliveryInstructions,
    subtotal,
    tax,
    total,
    items,
    headerImageUrl,
  } = order

  // Add header image if available
  const headerImageHtml = headerImageUrl
    ? `<img src="${headerImageUrl}" alt="Company Logo" style="max-width: 200px; height: auto; margin-bottom: 20px;">`
    : ""

  // Format delivery time from 24h to 12h format if needed
  const formatDeliveryTime = (time: string) => {
    try {
      if (time.includes("AM") || time.includes("PM")) return time

      const [hours, minutes] = time.split(":").map(Number)
      const period = hours >= 12 ? "PM" : "AM"
      const displayHours = hours % 12 || 12
      return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
    } catch (e) {
      return time
    }
  }

  const formattedDeliveryTime = formatDeliveryTime(deliveryTime)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - ${orderNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
          background-color: #ffffff;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .header {
          background-color: #f8f9fa;
          padding: 20px;
          text-align: center;
          border-bottom: 3px solid #1D2545;
        }
        .logo-container {
          margin-bottom: 15px;
        }
        .content {
          padding: 30px 20px;
        }
        .order-details {
          margin-bottom: 30px;
        }
        .order-details h2 {
          color: #1D2545;
          margin-bottom: 15px;
          font-size: 22px;
        }
        .delivery-info {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
          border-left: 4px solid #4a6da7;
        }
        .delivery-info h3 {
          color: #1D2545;
          margin-top: 0;
          margin-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #1D2545;
          color: white;
          text-align: left;
          padding: 10px;
          font-weight: 600;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }
        .total-row td {
          font-weight: bold;
          border-top: 2px solid #ddd;
          background-color: #f3f3f3;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666;
          background-color: #f8f9fa;
          border-top: 1px solid #ddd;
        }
        .text-right {
          text-align: right;
        }
        .attachment-note {
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-left: 4px solid #1D2545;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-container">
            ${headerImageHtml}
          </div>
          <h1 style="color: #1D2545; margin-bottom: 5px;">Order Confirmation</h1>
          <p style="margin-top: 5px;">Thank you for your order!</p>
        </div>
        
        <div class="content">
          <div class="order-details">
            <h2>Order: ${orderNumber}</h2>
            <p>Hello ${customerName},</p>
            <p>We're pleased to confirm your order has been received and is being processed.</p>
            <p><strong>Order Date:</strong> ${orderDate}</p>
          </div>
          
          <div class="delivery-info">
            <h3>Delivery Information</h3>
            <p><strong>Method:</strong> ${deliveryAddress ? "Delivery" : "Pickup"}</p>
            <p><strong>Date:</strong> ${deliveryDate}</p>
            <p><strong>Time:</strong> ${formattedDeliveryTime}</p>
            ${deliveryAddress ? `<p><strong>Address:</strong> ${deliveryAddress}</p>` : ""}
            ${deliveryInstructions ? `<p><strong>Instructions:</strong> ${deliveryInstructions}</p>` : ""}
          </div>
          
          <h3 style="background-color: #1D2545; color: white; padding: 10px 15px; margin-top: 30px; margin-bottom: 0; border-top-left-radius: 5px; border-top-right-radius: 5px;">Order Summary</h3>
          <table style="margin-top: 0; border: 1px solid #ddd; border-top: none;">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                <tr>
                  <td>${item.name || "Product"} ${item.sku ? `(${item.sku})` : ""}</td>
                  <td>${item.quantity} ${item.unit || ""}</td>
                  <td>${formatCurrency(item.unitPrice)}</td>
                  <td class="text-right">${formatCurrency(item.total)}</td>
                </tr>
              `,
                )
                .join("")}
              <tr>
                <td colspan="3" class="text-right"><strong>Subtotal:</strong></td>
                <td class="text-right">${formatCurrency(subtotal)}</td>
              </tr>
              <tr>
                <td colspan="3" class="text-right"><strong>Tax:</strong></td>
                <td class="text-right">${formatCurrency(tax)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3" class="text-right"><strong>Total:</strong></td>
                <td class="text-right">${formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
          
          <p>If you have any questions about your order, please contact us.</p>
          
          <div class="attachment-note">
            <p>A detailed PDF invoice of your order is attached to this email for your records. You can also view it online at any time.</p>
          </div>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Trade Supply Manager. All rights reserved.</p>
          <p>This email was sent to you as a confirmation of your recent order.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
