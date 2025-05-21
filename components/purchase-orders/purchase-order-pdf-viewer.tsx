"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Printer } from "lucide-react"
import { generatePurchaseOrderPdf } from "@/lib/pdf/generate-purchase-order-pdf"

interface PurchaseOrderPDFViewerProps {
  order: any
  orderItems: any[]
  settings?: {
    pdf_header_text?: string | null
    pdf_logo_url?: string | null
    storefront_image?: string | null
  }
}

export function PurchaseOrderPDFViewer({ order, orderItems, settings }: PurchaseOrderPDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function generatePDF() {
      try {
        setIsLoading(true)
        const pdfBuffer = await generatePurchaseOrderPdf({ order, orderItems, settings })

        // Convert buffer to blob URL
        const blob = new Blob([pdfBuffer], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
        setError(null)
      } catch (err: any) {
        console.error("Error generating PDF:", err)
        setError(err.message || "Failed to generate PDF")
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
  }, [order, orderItems, settings])

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
      a.download = `PurchaseOrder_${order.order_name}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
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
          <div className="text-red-500 mb-4">Error: {error}</div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Purchase Order PDF: {order.order_name}</h1>
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

      {pdfUrl && (
        <div className="w-full h-[800px] border border-gray-200 rounded-md overflow-hidden">
          <iframe src={pdfUrl} className="w-full h-full" title={`Purchase Order ${order.order_name} PDF`} />
        </div>
      )}
    </div>
  )
}
