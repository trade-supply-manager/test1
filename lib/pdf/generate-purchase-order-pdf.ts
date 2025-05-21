import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatDate, formatCurrency } from "@/lib/utils"
import { log, LogLevel } from "@/lib/debug-utils"

interface PurchaseOrderPdfData {
  order: any
  orderItems: any[]
  settings?: {
    storefront_image?: string | null
    pdf_header_text?: string | null
    pdf_logo_url?: string | null
    email_sender?: string | null
  }
}

/**
 * Generate a PDF buffer for a purchase order
 */
export async function generatePurchaseOrderPdf(data: PurchaseOrderPdfData): Promise<Buffer> {
  const { order, orderItems, settings } = data

  try {
    log(LogLevel.INFO, "generatePurchaseOrderPdf", "Starting PDF generation", {
      orderId: order.id,
      orderName: order.order_name,
      itemCount: orderItems.length,
    })

    // Define grayscale colors
    const darkGray = [60, 60, 60] // #3c3c3c - Dark gray for headers
    const mediumGray = [120, 120, 120] // #787878 - Medium gray for secondary elements
    const lightGray = [240, 240, 240] // #f0f0f0 - Light gray for backgrounds
    const borderGray = [200, 200, 200] // #c8c8c8 - Light gray for borders

    // Company name from settings
    const companyName = settings?.pdf_header_text || "Trade Supply Manager"

    // Create a new PDF document
    const doc = new jsPDF()

    // Set page margins
    const margin = 14
    const pageWidth = doc.internal.pageSize.width
    const contentWidth = pageWidth - margin * 2

    // Set starting Y position
    let yPos = margin

    // Use the logo from settings if available
    const logoUrl = settings?.pdf_logo_url || settings?.storefront_image

    // Add logo and header in a single row
    if (logoUrl) {
      try {
        log(LogLevel.INFO, "generatePurchaseOrderPdf", "Loading logo image", { logoUrl })

        // Load the image
        const img = new Image()
        img.crossOrigin = "anonymous" // Prevent CORS issues

        // Create a promise to wait for the image to load
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = (e) => {
            console.error("Error loading logo:", e)
            log(LogLevel.ERROR, "generatePurchaseOrderPdf", "Error loading logo", {
              logoUrl,
              error: e instanceof Error ? e.message : String(e),
            })
            reject(e)
          }

          // Set a timeout to prevent hanging if the image never loads
          const timeoutId = setTimeout(() => {
            log(LogLevel.WARN, "generatePurchaseOrderPdf", "Logo loading timed out", { logoUrl })
            reject(new Error("Logo loading timed out"))
          }, 10000) // 10 second timeout

          // Clear timeout on successful load
          img.onload = () => {
            clearTimeout(timeoutId)
            resolve(null)
          }

          img.src = logoUrl
        })

        // Calculate dimensions to maintain aspect ratio
        const imgWidth = 40 // Slightly larger logo for better visibility
        const imgHeight = (img.height * imgWidth) / img.width

        // Add the image to the PDF
        doc.addImage(img, "JPEG", margin, yPos, imgWidth, imgHeight)

        // Add header text to the right of the logo
        doc.setFontSize(16)
        doc.setTextColor(0, 0, 0) // Black text
        doc.text(companyName, margin + imgWidth + 8, yPos + imgHeight / 2 - 2)

        // Add "Purchase Order" text below company name
        doc.setFontSize(11)
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
        doc.text("Purchase Order", margin + imgWidth + 8, yPos + imgHeight / 2 + 6)

        // Update Y position
        yPos += Math.max(imgHeight, 20) + 5

        log(LogLevel.INFO, "generatePurchaseOrderPdf", "Logo added successfully")
      } catch (error) {
        log(LogLevel.ERROR, "generatePurchaseOrderPdf", "Error adding logo to PDF", error)

        // Fallback to text-only header
        doc.setFontSize(16)
        doc.setTextColor(0, 0, 0) // Black text
        doc.text(companyName, margin, yPos + 8)

        doc.setFontSize(11)
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
        doc.text("Purchase Order", margin, yPos + 16)

        yPos += 16
      }
    } else {
      // Text-only header
      doc.setFontSize(16)
      doc.setTextColor(0, 0, 0) // Black text
      doc.text(companyName, margin, yPos + 8)

      doc.setFontSize(11)
      doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
      doc.text("Purchase Order", margin, yPos + 16)

      yPos += 16
    }

    // Add a light gray background for the order summary section with rounded corners
    // doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])

    // Draw rounded rectangle
    const cornerRadius = 3
    const rectHeight = 12
    // doc.roundedRect(margin, yPos, contentWidth, rectHeight, cornerRadius, cornerRadius, "F")

    // Add order summary in a more compact layout
    // yPos += 6

    // Left column
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0) // Black text
    doc.text(`Order #: ${order.order_name}`, margin + 5, yPos)
    // doc.text(`Date: ${formatDate(order.date_created)}`, margin + 5, yPos + 10)

    // Right column
    const rightColumnX = pageWidth / 2
    doc.text(`Status: ${order.status}`, rightColumnX, yPos)
    // doc.text(`Payment: ${order.payment_status || "Unknown"}`, rightColumnX, yPos + 10)

    yPos += rectHeight + 2

    // Add manufacturer and delivery info in a more compact two-column layout
    const colWidth = contentWidth / 2 - 5

    // Create a rounded rectangle container for manufacturer and delivery info
    doc.setFillColor(255, 255, 255) // White background
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.roundedRect(margin, yPos, contentWidth, 50, cornerRadius, cornerRadius, "FD")

    // Manufacturer info column
    doc.setFontSize(11)
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
    doc.text("Manufacturer Information", margin + 5, yPos + 8)

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0) // Black text

    const manufacturerName = order.manufacturers?.manufacturer_name || "N/A"
    const manufacturerEmail = order.manufacturers?.email || "N/A"
    const manufacturerPhone = order.manufacturers?.phone_number || "N/A"
    const manufacturerAddress = order.manufacturers?.address || "N/A"

    doc.text(`Name: ${manufacturerName}`, margin + 5, yPos + 18)
    doc.text(`Email: ${manufacturerEmail}`, margin + 5, yPos + 26)
    doc.text(`Phone: ${manufacturerPhone}`, margin + 5, yPos + 34)

    // Handle address (potentially multi-line)
    const addressLines = doc.splitTextToSize(`Address: ${manufacturerAddress}`, colWidth - 5)
    let addressYPos = yPos + 42
    addressLines.forEach((line: string, index: number) => {
      if (index === 0) {
        doc.text(line, margin + 5, addressYPos)
      } else {
        doc.text(line, margin + 5 + 8, addressYPos) // Indent continuation lines
      }
      addressYPos += 6
    })

    // Delivery info column
    doc.setFontSize(11)
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
    doc.text("Delivery Information", margin + colWidth + 10, yPos + 8)

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0) // Black text

    doc.text(`Method: ${order.delivery_method || "N/A"}`, margin + colWidth + 10, yPos + 18)
    doc.text(`Date: ${formatDate(order.delivery_date)}`, margin + colWidth + 10, yPos + 26)
    doc.text(`Time: ${order.delivery_time || "N/A"}`, margin + colWidth + 10, yPos + 34)

    // Handle delivery address (potentially multi-line)
    if (order.delivery_address) {
      const deliveryAddressLines = doc.splitTextToSize(`Address: ${order.delivery_address}`, colWidth - 5)
      let deliveryAddressYPos = yPos + 42

      deliveryAddressLines.forEach((line: string, index: number) => {
        if (index === 0) {
          doc.text(line, margin + colWidth + 10, deliveryAddressYPos)
        } else {
          doc.text(line, margin + colWidth + 10 + 8, deliveryAddressYPos) // Indent continuation lines
        }
        deliveryAddressYPos += 6
      })
    }

    yPos += 58

    // Add order items table with improved styling and rounded corners
    doc.setFontSize(11)
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
    doc.text("Order Items", margin, yPos)

    yPos += 5

    const tableData = orderItems.map((item) => [
      item.products?.product_name || "Unknown Product",
      item.product_variants?.product_variant_name || "N/A",
      item.product_variants?.product_variant_sku || "N/A",
      item.quantity.toString(),
      formatCurrency(item.unit_price),
      item.discount_percentage > 0 ? `${item.discount_percentage}%` : "-",
      formatCurrency(item.total_order_item_value),
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["Product", "Variant", "SKU", "Qty", "Unit Price", "Disc", "Total"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: darkGray,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250],
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineWidth: 0.1,
        lineColor: borderGray,
        halign: "left",
        valign: "middle",
        font: "helvetica",
        minCellHeight: 10,
      },
      margin: { left: margin, right: margin },
      tableLineColor: borderGray,
      didDrawCell: (data) => {
        // This is a workaround to create rounded corners for the table
        // We can't directly create rounded corners for the table with jspdf-autotable
        // So we'll just ensure the borders are light enough to not be distracting
      },
    })

    // Add order totals in a right-aligned block with rounded corners
    // const finalY = (doc as any).lastAutoTable.finalY + 1
    const finalY = (doc as any).lastAutoTable.finalY - 1 // For even less space

    const totalsWidth = 70
    const totalsX = pageWidth - margin - totalsWidth

    // Add subtotal with light background and rounded corners
    // doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
    // doc.roundedRect(totalsX, finalY, totalsWidth, 14, cornerRadius, cornerRadius, "F")

    // doc.setFontSize(9)
    // doc.setTextColor(0, 0, 0) // Black text
    // doc.text("Subtotal:", totalsX + 5, finalY + 5)
    // doc.text(formatCurrency(order.subtotal_order_value || 0), totalsX + totalsWidth - 5, finalY + 5, {
    //  align: "right",
    // })

    // Add total with darker background and rounded corners
    // doc.setFillColor(darkGray[0], darkGray[1], darkGray[2])
    // doc.roundedRect(totalsX, finalY + 14, totalsWidth, 10, cornerRadius, cornerRadius, "F")

    doc.setFontSize(14)
    // doc.setTextColor(255, 255, 255) // White text on dark background
    doc.setTextColor(0, 0, 0) // Black text
    doc.text("Total:", totalsX + 5, finalY + 21)
    doc.text(formatCurrency(order.total_order_value || 0), totalsX + totalsWidth - 5, finalY + 21, { align: "right" })

    // Add notes if available with rounded corners
    if (order.notes) {
      const notesY = finalY + 30

      doc.setFontSize(11)
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
      doc.text("Notes", margin, notesY)

      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0) // Black text
      const noteLines = doc.splitTextToSize(order.notes, contentWidth)

      // Draw rounded rectangle for notes
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
      doc.setFillColor(255, 255, 255) // White background
      doc.roundedRect(margin, notesY + 4, contentWidth, noteLines.length * 5 + 6, cornerRadius, cornerRadius, "FD")

      noteLines.forEach((line: string, index: number) => {
        doc.text(line, margin + 3, notesY + 8 + index * 5)
      })
    }

    // Add terms and conditions section
    const termsY = order.notes ? finalY + 50 + doc.splitTextToSize(order.notes, contentWidth).length * 5 : finalY + 30

    doc.setFontSize(11)
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
    doc.text("Terms and Conditions", margin, termsY)

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0) // Black text
    const termsText =
      "1. All prices are in CAD unless otherwise specified.\n" +
      "2. Confirm the delivery time and order items listed.\n" +
      "3. Please reference the purchase order number on all invoices and correspondence."

    const termsLines = doc.splitTextToSize(termsText, contentWidth)

    // Draw rounded rectangle for terms
    // doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    // doc.setFillColor(255, 255, 255) // White background
    // doc.roundedRect(margin, termsY + 4, contentWidth, termsLines.length * 5 + 6, cornerRadius, cornerRadius, "FD")

    termsLines.forEach((line: string, index: number) => {
      doc.text(line, margin + 3, termsY + 8 + index * 5)
    })

    // Add footer with page numbers
    const footerY = doc.internal.pageSize.height - 10

    doc.setFontSize(8)
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])

    // Add page numbers to each page
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.text(`Page ${i} of ${pageCount} - Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, footerY, {
        align: "center",
      })
    }

    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

    log(LogLevel.INFO, "generatePurchaseOrderPdf", "PDF generation completed successfully", {
      bufferSize: pdfBuffer.length,
      pageCount,
    })

    return pdfBuffer
  } catch (error) {
    log(LogLevel.ERROR, "generatePurchaseOrderPdf", "Error generating PDF", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderId: order?.id,
      orderName: order?.order_name,
    })

    // Create a simple fallback PDF with error information
    try {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text("Error Generating Purchase Order PDF", 20, 30)

      doc.setFontSize(12)
      doc.text(`Order: ${order?.order_name || "Unknown"}`, 20, 50)
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 60)

      doc.setFontSize(10)
      doc.text("There was an error generating the complete PDF. Please contact support.", 20, 80)

      // Add basic order information
      if (order) {
        doc.text(`Manufacturer: ${order.manufacturers?.manufacturer_name || "Unknown"}`, 20, 100)
        doc.text(`Status: ${order.status || "Unknown"}`, 20, 110)
        doc.text(`Total: ${formatCurrency(order.total_order_value || 0)}`, 20, 120)
      }

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
      return pdfBuffer
    } catch (fallbackError) {
      log(LogLevel.ERROR, "generatePurchaseOrderPdf", "Fallback PDF generation also failed", fallbackError)
      // If even the fallback fails, return an empty PDF
      const emptyDoc = new jsPDF()
      emptyDoc.text("PDF Generation Failed", 20, 20)
      return Buffer.from(emptyDoc.output("arraybuffer"))
    }
  }
}
