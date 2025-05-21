"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle, Clock } from "lucide-react"

export default function MigrateImagesPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleMigration = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/migrate-images", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || "Migration failed")
      }

      setResults(data)
    } catch (err) {
      console.error("Migration error:", err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Migrate Product Variant Images</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Image Migration Tool</CardTitle>
          <CardDescription>
            This tool will migrate product variant images from the old storage bucket to the new
            "product-variant-images" bucket, organizing them by product ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">The migration process will:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Find all product variants with images</li>
            <li>Download images from the old bucket</li>
            <li>Upload them to the new bucket in a product-specific folder</li>
            <li>Update the database records with the new URLs</li>
          </ol>
        </CardContent>
        <CardFooter>
          <Button onClick={handleMigration} disabled={isLoading}>
            {isLoading ? "Migrating..." : "Start Migration"}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Migration Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                  <h3 className="font-medium">Successful</h3>
                </div>
                <p className="text-2xl font-bold">{results.success}</p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center mb-2">
                  <Clock className="h-5 w-5 text-yellow-600 mr-2" />
                  <h3 className="font-medium">Skipped</h3>
                </div>
                <p className="text-2xl font-bold">{results.skipped}</p>
              </div>

              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <h3 className="font-medium">Failed</h3>
                </div>
                <p className="text-2xl font-bold">{results.failed}</p>
              </div>
            </div>

            {results.details.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Details</h3>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Variant ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.details.map((detail, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{detail.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                detail.status === "success"
                                  ? "bg-green-100 text-green-800"
                                  : detail.status === "skipped"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {detail.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {detail.error || detail.reason || (detail.oldUrl && `Migrated from ${detail.oldUrl}`)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
