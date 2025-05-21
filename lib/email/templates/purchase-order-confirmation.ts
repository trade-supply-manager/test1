interface PurchaseOrderConfirmationTemplateProps {
  orderName: string
  manufacturerName: string
  items: Array<{
    name: string
    sku: string
    quantity: number
    unit: string
    price: number
    total: number
  }>
  subtotal: number
  total: number
  deliveryMethod: string
  deliveryDate: Date
  deliveryTime: string
  deliveryAddress?: string
  deliveryInstructions?: string
  notes?: string
  customMessage?: string
  recipientName: string
  senderName: string
  hasPdfAttachment?: boolean // New prop to indicate if PDF is attached
}

export function purchaseOrderConfirmationTemplate({
  orderName,
  manufacturerName,
  items,
  subtotal,
  total,
  deliveryMethod,
  deliveryDate,
  deliveryTime,
  deliveryAddress,
  deliveryInstructions,
  notes,
  customMessage,
  recipientName,
  senderName,
  hasPdfAttachment = true, // Default to true for backward compatibility
}: PurchaseOrderConfirmationTemplateProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  // Create HTML content
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Order: ${orderName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
          }
          .content {
            padding: 20px 0;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
            font-size: 12px;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
            text-align: left;
          }
          th {
            background-color: #f8f9fa;
          }
          .total-row {
            font-weight: bold;
          }
          .custom-message {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #007bff;
          }
          .pdf-note {
            background-color: #fff3cd;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #ffc107;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Purchase Order: ${orderName}</h1>
            <p>For: ${manufacturerName}</p>
          </div>
          
          <div class="content">
            <p>Dear ${recipientName},</p>
            
            <p>Please find attached the purchase order details for ${orderName}.</p>
            
            ${customMessage ? `<div class="custom-message">${customMessage}</div>` : ""}
            
            ${
              !hasPdfAttachment
                ? `
            <div class="pdf-note">
              <strong>Note:</strong> The PDF attachment could not be generated. Please find the order details below or contact us if you need the PDF version.
            </div>
            `
                : ""
            }

            <h2>Order Summary</h2>
            
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                <tr>
                  <td>${item.name}<br><small>SKU: ${item.sku}</small></td>
                  <td>${item.quantity} ${item.unit}</td>
                  <td>${formatCurrency(item.price)}</td>
                  <td>${formatCurrency(item.total)}</td>
                </tr>
                `,
                  )
                  .join("")}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right;">Subtotal:</td>
                  <td>${formatCurrency(subtotal)}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="3" style="text-align: right;">Total:</td>
                  <td>${formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
            
            <h2>Delivery Information</h2>
            <p>
              <strong>Method:</strong> ${deliveryMethod}<br>
              <strong>Date:</strong> ${formatDate(deliveryDate)}<br>
              <strong>Time:</strong> ${deliveryTime}<br>
              ${deliveryAddress ? `<strong>Address:</strong> ${deliveryAddress}<br>` : ""}
              ${deliveryInstructions ? `<strong>Instructions:</strong> ${deliveryInstructions}<br>` : ""}
            </p>
            
            ${
              notes
                ? `
            <h2>Notes</h2>
            <p>${notes}</p>
            `
                : ""
            }
            
            <p>If you have any questions or concerns regarding this order, please reply to this email directly.</p>
            
            <p>
              Best regards,<br>
              ${senderName}
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
    </html>
  `

  // Create plain text content
  const text = `
Purchase Order: ${orderName}
For: ${manufacturerName}

Dear ${recipientName},

Please find attached the purchase order details for ${orderName}.

${customMessage ? `Message: ${customMessage}\n\n` : ""}

${!hasPdfAttachment ? "Note: The PDF attachment could not be generated. Please find the order details below or contact us if you need the PDF version.\n\n" : ""}

ORDER SUMMARY:
${items
  .map(
    (item) =>
      `- ${item.name} (SKU: ${item.sku}): ${item.quantity} ${
        item.unit
      } x ${formatCurrency(item.price)} = ${formatCurrency(item.total)}`,
  )
  .join("\n")}

Subtotal: ${formatCurrency(subtotal)}
Total: ${formatCurrency(total)}

DELIVERY INFORMATION:
Method: ${deliveryMethod}
Date: ${formatDate(deliveryDate)}
Time: ${deliveryTime}
${deliveryAddress ? `Address: ${deliveryAddress}` : ""}
${deliveryInstructions ? `Instructions: ${deliveryInstructions}` : ""}

${notes ? `NOTES:\n${notes}\n\n` : ""}

If you have any questions or concerns regarding this order, please don't hesitate to contact us.

Best regards,
${senderName}

This is an automated email. Please do not reply directly to this message.
  `

  return { html, text }
}
