"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Printer, RefreshCw, AlertTriangle } from "lucide-react"

interface CustomerOrderPDFProps {
  order: any
  orderItems: any[]
  settings?: {
    pdf_header_text?: string | null
    pdf_logo_url?: string | null
    storefront_image?: string | null
  }
}

export function CustomerOrderPDF({ order, orderItems, settings }: CustomerOrderPDFProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfSize, setPdfSize] = useState<number | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    async function generatePDF() {
      try {
        setIsLoading(true)
        setError(null)

        console.log(`📄 Generating PDF for order: ${order.id}, attempt ${retryCount + 1}`)

        // Use the API endpoint instead of direct generation
        const baseUrl = window.location.origin
        const response = await fetch(`${baseUrl}/api/customer-orders/${order.id}/pdf`, {
          method: "GET",
          headers: {
            Accept: "application/pdf",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        })

        if (!response.ok) {
          let errorMessage = `Server responded with status: ${response.status}`
          try {
            const errorText = await response.text()
            errorMessage = errorText || errorMessage
          } catch (e) {
            // Ignore text parsing errors
          }
          throw new Error(errorMessage)
        }

        // Get content type to verify it's a PDF
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/pdf")) {
          throw new Error(`Expected PDF but got ${contentType}`)
        }

        // Get the PDF data
        const blob = await response.blob()
        setPdfSize(blob.size)

        // Check if the PDF is suspiciously small
        if (blob.size < 5000) {
          console.warn(`⚠️ PDF is suspiciously small: ${blob.size} bytes`)

          if (blob.size < 1000) {
            throw new Error(`Generated PDF is too small (${blob.size} bytes) and likely corrupted`)
          }
        }

        // Create a blob URL
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
        setError(null)

        console.log(`✅ PDF generated successfully: ${blob.size} bytes`)
      } catch (err: any) {
        console.error("❌ Error generating PDF:", err)
        setError(err.message || "Failed to generate PDF")
        setPdfUrl(null)
      } finally {
        setIsLoading(false)
      }
    }

    generatePDF()

    // Cleanup function to revoke the blob URL
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [order, orderItems, settings, retryCount])

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, "_blank")
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.print()
        })
      }
    }
  }

  const handleDownload = () => {
    if (pdfUrl) {
      const a = document.createElement("a")
      a.href = pdfUrl
      a.download = `Order_${order.order_name}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1)
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Generating PDF...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <div className="text-red-500 mb-4">Error: {error}</div>
          <Button variant="outline" onClick={handleRetry} className="mr-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Order PDF: {order.order_name}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {pdfSize && pdfSize < 10000 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-sm flex items-start">
          <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 text-amber-500" />
          <p>
            Warning: The PDF file is smaller than expected ({(pdfSize / 1024).toFixed(1)} KB). It may not display
            correctly. You can try the "Try Again" button if the PDF appears incomplete.
          </p>
        </div>
      )}

      {pdfUrl && (
        <div className="w-full h-[800px] border border-gray-200 rounded-md overflow-hidden">
          <iframe src={pdfUrl} className="w-full h-full" title={`Order ${order.order_name} PDF`} />
          {pdfSize && pdfSize < 5000 && (
            <div className="mt-2 flex justify-center">
              <Button variant="outline" onClick={handleRetry} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate PDF
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
