import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatDate, formatCurrency } from "@/lib/utils"
import { log, LogLevel } from "@/lib/debug-utils"

interface OrderPdfData {
  order: any
  orderItems: any[]
  settings?: {
    storefront_image?: string | null
    pdf_header_text?: string | null
    pdf_logo_url?: string | null
    email_sender?: string | null
    company_name?: string | null
  }
}

/**
 * Generate a PDF buffer for an order
 */
export async function generateOrderPdf(data: OrderPdfData): Promise<Buffer> {
  try {
    const { order, orderItems, settings } = data

    // Enhanced logging for debugging
    console.log("📄 generateOrderPdf: Starting PDF generation", {
      orderId: order?.id,
      orderName: order?.order_name,
      itemCount: orderItems?.length,
      hasSettings: !!settings,
      settingsKeys: settings ? Object.keys(settings) : [],
    })

    log(LogLevel.INFO, "generateOrderPdf", "Starting PDF generation", {
      orderId: order?.id,
      orderName: order?.order_name,
      itemCount: orderItems?.length,
      hasSettings: !!settings,
      settingsKeys: settings ? Object.keys(settings) : [],
    })

    // Validate input data
    if (!order) {
      throw new Error("Order data is required for PDF generation")
    }

    if (!Array.isArray(orderItems)) {
      throw new Error("Order items must be an array")
    }

    // Define grayscale colors
    const darkGray = [60, 60, 60] // #3c3c3c - Dark gray for headers
    const mediumGray = [120, 120, 120] // #787878 - Medium gray for secondary elements
    const lightGray = [240, 240, 240] // #f0f0f0 - Light gray for backgrounds
    const borderGray = [200, 200, 200] // #c8c8c8 - Light gray for borders

    // Company name from settings - support multiple possible field names
    const companyName = settings?.pdf_header_text || settings?.company_name || "Trade Supply Manager"

    // Enhanced logging for debugging
    console.log("📄 generateOrderPdf: Using company name", { companyName })
    log(LogLevel.INFO, "generateOrderPdf", "Using company name", { companyName })

    // Create a new PDF document
    const doc = new jsPDF()

    // Set page margins
    const margin = 14
    const pageWidth = doc.internal.pageSize.width
    const contentWidth = pageWidth - margin * 2

    // Set starting Y position
    let yPos = margin

    // Use the logo from settings if available - support multiple possible field names
    const logoUrl = settings?.pdf_logo_url || settings?.storefront_image || null

    // Enhanced logging for debugging
    console.log("📄 generateOrderPdf: Logo URL from settings", { logoUrl })
    log(LogLevel.INFO, "generateOrderPdf", "Logo URL from settings", { logoUrl })

    // Add logo and header in a single row
    if (logoUrl) {
      try {
        console.log("📄 generateOrderPdf: Attempting to load logo", { logoUrl })
        log(LogLevel.INFO, "generateOrderPdf", "Attempting to load logo", { logoUrl })

        // Load the image - using a completely rewritten approach
        const img = new Image()
        img.crossOrigin = "anonymous" // Prevent CORS issues

        // Create a promise to wait for the image to load - completely rewritten
        const imageLoadPromise = new Promise<void>((resolve, reject) => {
          // Set a timeout to prevent hanging if the image never loads
          const timeoutId = setTimeout(() => {
            console.warn("⚠️ Logo loading timed out after 10 seconds", { logoUrl })
            log(LogLevel.WARN, "generateOrderPdf", "Logo loading timed out", { logoUrl })
            reject(new Error("Logo loading timed out"))
          }, 10000) // 10 second timeout

          // Define onload handler
          img.onload = () => {
            console.log("✅ Logo loaded successfully", {
              width: img.width,
              height: img.height,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              complete: img.complete,
            })
            clearTimeout(timeoutId)
            resolve()
          }

          // Define error handler
          img.onerror = (e) => {
            console.error("❌ Error loading logo:", e)
            clearTimeout(timeoutId)
            log(LogLevel.ERROR, "generateOrderPdf", "Error loading logo", {
              logoUrl,
              error: e instanceof Error ? e.message : String(e),
            })
            reject(new Error(`Failed to load image: ${e}`))
          }

          // Set the source AFTER defining handlers
          img.src = logoUrl
        })

        // Wait for the image to load
        await imageLoadPromise
        console.log("📄 generateOrderPdf: Image loaded, proceeding with PDF generation")

        // Calculate dimensions to maintain aspect ratio
        const imgWidth = 40 // Slightly larger logo for better visibility
        const imgHeight = img.naturalHeight ? (img.naturalHeight * imgWidth) / img.naturalWidth : 20

        console.log("📄 generateOrderPdf: Adding image to PDF", {
          imgWidth,
          imgHeight,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        })

        // Add the image to the PDF - using explicit format
        doc.addImage({
          imageData: img,
          format: "JPEG", // Explicitly specify format
          x: margin,
          y: yPos,
          width: imgWidth,
          height: imgHeight,
        })

        console.log("📄 generateOrderPdf: Logo added to PDF successfully")
        log(LogLevel.INFO, "generateOrderPdf", "Logo added to PDF", { width: imgWidth, height: imgHeight })

        // Add header text to the right of the logo
        doc.setFontSize(16)
        doc.setTextColor(0, 0, 0) // Black text
        doc.text(companyName, margin + imgWidth + 8, yPos + imgHeight / 2 - 2)

        // Add "Customer Order" text below company name
        doc.setFontSize(11)
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
        doc.text("Customer Order", margin + imgWidth + 8, yPos + imgHeight / 2 + 6)

        // Update Y position
        yPos += Math.max(imgHeight, 20) + 5
      } catch (error) {
        console.error("❌ Error adding logo to PDF:", error)
        log(LogLevel.ERROR, "generateOrderPdf", "Error adding logo to PDF", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })

        // Fallback to text-only header
        doc.setFontSize(16)
        doc.setTextColor(0, 0, 0) // Black text
        doc.text(companyName, margin, yPos + 8)

        doc.setFontSize(11)
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
        doc.text("Customer Order", margin, yPos + 16)

        yPos += 20
      }
    } else {
      // Text-only header
      console.log("📄 generateOrderPdf: No logo URL found, using text-only header")
      log(LogLevel.INFO, "generateOrderPdf", "No logo URL found, using text-only header")

      doc.setFontSize(16)
      doc.setTextColor(0, 0, 0) // Black text
      doc.text(companyName, margin, yPos + 8)

      doc.setFontSize(11)
      doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
      doc.text("Customer Order", margin, yPos + 16)

      yPos += 20
    }

    // Add a light gray background for the order summary section with rounded corners
    // doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])

    // Draw rounded rectangle
    const cornerRadius = 3
    const rectHeight = 26
    // doc.roundedRect(margin, yPos, contentWidth, rectHeight, cornerRadius, cornerRadius, "F")

    // Add order summary in a more compact layout
    yPos += 1

    // Left column
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0) // Black text
    doc.text(`Order #: ${order.order_name}`, margin + 5, yPos)
    doc.text(`Date: ${formatDate(order.date_created)}`, margin + 5, yPos + 10)

    // Right column
    const rightColumnX = pageWidth / 2
    doc.text(`Status: ${order.status}`, rightColumnX, yPos)
    doc.text(`Payment: ${order.payment_status || "Unknown"}`, rightColumnX, yPos + 10)

    yPos += rectHeight + 1
    // yPos = 4
    // Add customer and delivery info in a more compact two-column layout
    const colWidth = contentWidth / 2 - 5

    // Create a rounded rectangle container for customer and delivery info
    doc.setFillColor(255, 255, 255) // White background
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.roundedRect(margin, yPos, contentWidth, 50, cornerRadius, cornerRadius, "FD")

    // Customer info column
    doc.setFontSize(11)
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
    doc.text("Customer Information", margin + 5, yPos + 8)

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0) // Black text

    const customerName = order.customers?.customer_name || "N/A"
    const customerEmail = order.customers?.email || "N/A"
    const customerPhone = order.customers?.phone_number || "N/A"

    doc.text(`Name: ${customerName}`, margin + 5, yPos + 18)
    doc.text(`Email: ${customerEmail}`, margin + 5, yPos + 26)
    doc.text(`Phone: ${customerPhone}`, margin + 5, yPos + 34)

    // Delivery info column
    doc.setFontSize(11)
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
    doc.text("Delivery Information", margin + colWidth + 10, yPos + 8)

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0) // Black text

    doc.text(`Method: ${order.delivery_method}`, margin + colWidth + 10, yPos + 18)
    doc.text(`Date: ${formatDate(order.delivery_date)}`, margin + colWidth + 10, yPos + 26)
    doc.text(`Time: ${order.delivery_time}`, margin + colWidth + 10, yPos + 34)

    // Handle delivery address (potentially multi-line)
    if (order.delivery_address) {
      const addressLines = doc.splitTextToSize(`Address: ${order.delivery_address}`, colWidth - 5)
      let addressYPos = yPos + 42

      addressLines.forEach((line: string, index: number) => {
        if (index === 0) {
          doc.text(line, margin + colWidth + 10, addressYPos)
        } else {
          doc.text(line, margin + colWidth + 10 + 8, addressYPos) // Indent continuation lines
        }
        addressYPos += 6
      })
    }

    yPos += 58

    // Add order items table with improved styling and rounded corners
    doc.setFontSize(11)
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
    doc.text("Order Items", margin, yPos)

    yPos += 5

    // Verify order items data
    console.log(`📄 generateOrderPdf: Processing ${orderItems.length} order items for PDF`)
    log(LogLevel.INFO, "generateOrderPdf", `Processing ${orderItems.length} order items for PDF`)

    // Ensure we have valid data for the table
    const tableData = orderItems.map((item) => {
      // Safely extract values with fallbacks
      const productName = item.products?.product_name || "Unknown Product"
      const variantName = item.product_variants?.product_variant_name || "N/A"
      const sku = item.product_variants?.product_variant_sku || "N/A" // Include SKU
      const quantity = item.quantity?.toString() || "0"
      const unitPrice = typeof item.unit_price === "number" ? formatCurrency(item.unit_price) : "$0.00"
      const discount =
        typeof item.discount_percentage === "number" && item.discount_percentage > 0
          ? `${item.discount_percentage}%`
          : "-"
      const total =
        typeof item.total_order_item_value === "number" ? formatCurrency(item.total_order_item_value) : "$0.00"

      return [productName, variantName, sku, quantity, unitPrice, total]
    })

    // Add the table with error handling
    try {
      autoTable(doc, {
        startY: yPos,
        head: [["Product", "Variant", "SKU", "Qty", "Unit Price", "Total"]],
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
      })

      console.log("📄 generateOrderPdf: Order items table added to PDF")
      log(LogLevel.INFO, "generateOrderPdf", "Order items table added to PDF")
    } catch (tableError) {
      console.error("❌ Error adding items table to PDF:", tableError)
      log(LogLevel.ERROR, "generateOrderPdf", "Error adding items table to PDF", {
        error: tableError instanceof Error ? tableError.message : String(tableError),
      })

      // Add a simple error message instead of the table
      doc.setTextColor(255, 0, 0)
      doc.text("Error rendering order items table", margin, yPos + 10)

      // Set a default finalY value to continue with the rest of the PDF
      ;(doc as any).lastAutoTable = { finalY: yPos + 20 }
    }

    // Add order totals in a right-aligned block with rounded corners
    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 20
    const totalsWidth = 70
    const totalsX = pageWidth - margin - totalsWidth

    // Add subtotal and tax with light background and rounded corners
    // doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
    // doc.roundedRect(totalsX, finalY, totalsWidth, 14, cornerRadius, cornerRadius, "F")

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0) // Black text
    doc.text("Subtotal:", totalsX + 5, finalY + 5)
    doc.text(formatCurrency(order.subtotal_order_value || 0), totalsX + totalsWidth - 5, finalY + 5, {
      align: "right",
    })

    doc.text(`Tax (${order.tax_rate}%):`, totalsX + 5, finalY + 12)
    doc.text(
      formatCurrency((order.total_order_value || 0) - (order.subtotal_order_value || 0)),
      totalsX + totalsWidth - 5,
      finalY + 12,
      { align: "right" },
    )

    // Add total with darker background and rounded corners
    // doc.setFillColor(darkGray[0], darkGray[1], darkGray[2])
    // doc.roundedRect(totalsX, finalY + 14, totalsWidth, 10, cornerRadius, cornerRadius, "F")

    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0) // White text on dark background
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
    console.log(`📄 generateOrderPdf: Finalizing PDF document with ${pageCount} pages`)
    log(LogLevel.INFO, "generateOrderPdf", `Finalizing PDF document with ${pageCount} pages`)

    // Use a try-catch block specifically for the buffer conversion
    try {
      const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

      // Verify the buffer size
      console.log(`📄 generateOrderPdf: PDF buffer size: ${pdfBuffer.length} bytes`)
      log(LogLevel.INFO, "generateOrderPdf", `PDF buffer size: ${pdfBuffer.length} bytes`)

      if (pdfBuffer.length < 1000) {
        console.warn(`⚠️ Generated PDF buffer is suspiciously small: ${pdfBuffer.length} bytes`)
        log(LogLevel.WARN, "generateOrderPdf", `Generated PDF buffer is suspiciously small: ${pdfBuffer.length} bytes`)
      }

      return pdfBuffer
    } catch (bufferError) {
      console.error("❌ Error converting PDF to buffer:", bufferError)
      log(LogLevel.ERROR, "generateOrderPdf", "Error converting PDF to buffer", {
        error: bufferError instanceof Error ? bufferError.message : String(bufferError),
      })

      // Return an empty buffer as a last resort
      return Buffer.from([])
    }
  } catch (error) {
    console.error("❌ Error in generateOrderPdf:", error)
    log(LogLevel.ERROR, "generateOrderPdf", "Error in generateOrderPdf", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Create a simple error PDF
    try {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.setTextColor(255, 0, 0)
      doc.text("Error Generating PDF", 20, 30)

      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text("There was an error generating this order PDF.", 20, 50)
      doc.text("Please contact support for assistance.", 20, 65)

      const errorBuffer = Buffer.from(doc.output("arraybuffer"))
      console.log(`📄 generateOrderPdf: Error PDF buffer size: ${errorBuffer.length} bytes`)
      log(LogLevel.INFO, "generateOrderPdf", `Error PDF buffer size: ${errorBuffer.length} bytes`)
      return errorBuffer
    } catch (fallbackError) {
      console.error("❌ Even fallback PDF generation failed:", fallbackError)
      log(LogLevel.ERROR, "generateOrderPdf", "Even fallback PDF generation failed", {
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      })
      return Buffer.from([])
    }
  }
}
