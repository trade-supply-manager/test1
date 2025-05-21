"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Printer } from "lucide-react"

interface PurchaseOrderPdfClientProps {
  orderId: string
  orderName: string
}

export function PurchaseOrderPdfClient({ orderId, orderName }: PurchaseOrderPdfClientProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch the PDF from the API route
      const response = await fetch(`/api/purchase-orders/${orderId}/pdf`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate PDF")
      }

      // Get the PDF blob
      const blob = await response.blob()

      // Create a URL for the blob
      const url = URL.createObjectURL(blob)

      // Create a link element and trigger download
      const a = document.createElement("a")
      a.href = url
      a.download = `purchase_order_${orderName}.pdf`
      document.body.appendChild(a)
      a.click()

      // Clean up
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error("Error downloading PDF:", err)
      setError(err.message || "Failed to download PDF")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch the PDF from the API route
      const response = await fetch(`/api/purchase-orders/${orderId}/pdf`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate PDF")
      }

      // Get the PDF blob
      const blob = await response.blob()

      // Create a URL for the blob
      const url = URL.createObjectURL(blob)

      // Open the PDF in a new window and print it
      const printWindow = window.open(url, "_blank")
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.print()
          URL.revokeObjectURL(url)
        })
      } else {
        URL.revokeObjectURL(url)
        throw new Error("Failed to open print window. Please check your popup blocker settings.")
      }
    } catch (err: any) {
      console.error("Error printing PDF:", err)
      setError(err.message || "Failed to print PDF")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="flex space-x-2">
        <Button variant="outline" onClick={handlePrint} disabled={isLoading}>
          <Printer className="mr-2 h-4 w-4" />
          {isLoading ? "Loading..." : "Print"}
        </Button>
        <Button onClick={handleDownload} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          {isLoading ? "Loading..." : "Download PDF"}
        </Button>
      </div>
      {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}
    </div>
  )
}
