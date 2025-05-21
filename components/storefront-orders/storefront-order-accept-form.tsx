"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, Loader2, Bug, AlertTriangle, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StorefrontOrderAcceptFormProps {
  order: any
}

interface Customer {
  id: string
  customer_name: string
  email: string
}

export function StorefrontOrderAcceptForm({ order }: StorefrontOrderAcceptFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [convertToCustomerOrder, setConvertToCustomerOrder] = useState(true)
  const [debugInfo, setDebugInfo] = useState<any | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  // Customer selection state
  const [matchingCustomers, setMatchingCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [hasMatchingCustomers, setHasMatchingCustomers] = useState(false)

  const supabase = getSupabaseClient()

  // Check for existing customers with matching email when component mounts
  useEffect(() => {
    if (order?.storefront_customers?.email) {
      checkForExistingCustomers(order.storefront_customers.email)
    }
  }, [order])

  // Function to check for existing customers with matching email
  const checkForExistingCustomers = async (email: string) => {
    if (!email) return

    setIsLoadingCustomers(true)

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_name, email")
        .eq("email", email)
        .order("customer_name")

      if (error) {
        console.error("Error checking for existing customers:", error)
        return
      }

      if (data && data.length > 0) {
        setMatchingCustomers(data)
        setHasMatchingCustomers(true)
      } else {
        setMatchingCustomers([])
        setHasMatchingCustomers(false)
      }
    } catch (error) {
      console.error("Error in customer check:", error)
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  // Get the selected customer object
  const selectedCustomer = selectedCustomerId ? matchingCustomers.find((c) => c.id === selectedCustomerId) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setDebugInfo(null)
    setShowDebug(false)

    try {
      console.log("Submitting accept order form for order ID:", order.id)
      console.log("Selected customer ID:", selectedCustomerId)

      // First, accept the order
      const acceptResponse = await fetch(`/api/storefront-orders/${order.id}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes }),
      })

      // Capture the full response text for debugging
      const responseText = await acceptResponse.text()
      console.log("Accept order response status:", acceptResponse.status)
      console.log("Accept order response text:", responseText)

      // Try to parse as JSON for structured debugging
      let parsedResponse: any = null
      try {
        parsedResponse = JSON.parse(responseText)
        setDebugInfo({
          status: acceptResponse.status,
          statusText: acceptResponse.statusText,
          data: parsedResponse,
          raw: responseText,
        })
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError)
        setDebugInfo({
          status: acceptResponse.status,
          statusText: acceptResponse.statusText,
          error: "Failed to parse response as JSON",
          raw: responseText,
        })
      }

      // Show debug panel for non-200 responses
      if (!acceptResponse.ok) {
        setShowDebug(true)
        let errorMessage = `Failed to accept order (Status: ${acceptResponse.status})`

        if (parsedResponse && parsedResponse.error) {
          errorMessage = parsedResponse.error
          if (parsedResponse.details) {
            errorMessage += `: ${JSON.stringify(parsedResponse.details)}`
          }
        } else {
          // If no structured error, use the raw response
          errorMessage = `${errorMessage}. Server response: ${responseText.substring(0, 100)}...`
        }

        throw new Error(errorMessage)
      }

      // If conversion is enabled, convert to customer order
      if (convertToCustomerOrder) {
        console.log("Converting to customer order...")

        // Prepare the request body
        const convertRequestBody = {
          notes,
          selectedCustomerId: selectedCustomerId,
        }

        console.log("Convert request body:", convertRequestBody)

        const convertResponse = await fetch(`/api/storefront-orders/${order.id}/convert-to-customer-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(convertRequestBody),
        })

        const convertResponseText = await convertResponse.text()
        console.log("Convert order response status:", convertResponse.status)
        console.log("Convert order response text:", convertResponseText)

        // Try to parse convert response
        let parsedConvertResponse: any = null
        try {
          parsedConvertResponse = JSON.parse(convertResponseText)
          setDebugInfo((prev) => ({
            ...prev,
            convert: {
              status: convertResponse.status,
              statusText: convertResponse.statusText,
              data: parsedConvertResponse,
              raw: convertResponseText,
            },
          }))
        } catch (parseError) {
          console.error("Failed to parse convert response as JSON:", parseError)
          setDebugInfo((prev) => ({
            ...prev,
            convert: {
              status: convertResponse.status,
              statusText: convertResponse.statusText,
              error: "Failed to parse response as JSON",
              raw: convertResponseText,
            },
          }))
        }

        if (!convertResponse.ok) {
          setShowDebug(true)
          let errorMessage = `Failed to convert order (Status: ${convertResponse.status})`

          if (parsedConvertResponse && parsedConvertResponse.error) {
            errorMessage = parsedConvertResponse.error
            if (parsedConvertResponse.details) {
              errorMessage += `: ${JSON.stringify(parsedConvertResponse.details)}`
            }
          } else {
            errorMessage = `${errorMessage}. Server response: ${convertResponseText.substring(0, 100)}...`
          }

          // Still show success for accepting, but warn about conversion failure
          toast({
            title: "Order Accepted",
            description: `Order was accepted but could not be converted to a customer order: ${errorMessage}`,
            variant: "warning",
          })

          setTimeout(() => {
            router.push("/dashboard/storefront-orders")
          }, 1500)
          return
        }

        const customerOrderId = parsedConvertResponse?.customerOrderId

        toast({
          title: "Order Accepted and Converted",
          description: "The order has been accepted and converted to a customer order successfully.",
        })

        // Redirect to the new customer order if available
        if (customerOrderId) {
          setTimeout(() => {
            router.push(`/dashboard/customer-orders/${customerOrderId}`)
          }, 1500)
          return
        }
      } else {
        toast({
          title: "Order Accepted",
          description: "The order has been accepted successfully.",
        })
      }

      // Redirect back to the storefront orders list
      setTimeout(() => {
        router.push("/dashboard/storefront-orders")
      }, 1500)
    } catch (error: any) {
      console.error("Error in accept order process:", error)

      toast({
        title: "Error",
        description: error.message || "An error occurred while accepting the order.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Accept Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showDebug && debugInfo && (
            <Alert variant="destructive">
              <Bug className="h-4 w-4" />
              <AlertTitle>Technical Details</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold">Status:</span> {debugInfo.status} {debugInfo.statusText}
                  </div>

                  {debugInfo.data?.executionLog && (
                    <div>
                      <details>
                        <summary className="cursor-pointer font-medium">Execution Log</summary>
                        <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                          <ul className="list-disc pl-5 space-y-1">
                            {debugInfo.data.executionLog.map((log: string, i: number) => (
                              <li key={i}>{log}</li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    </div>
                  )}

                  {debugInfo.data?.error && (
                    <div>
                      <span className="font-semibold">Error:</span> {debugInfo.data.error}
                    </div>
                  )}

                  {debugInfo.data?.details && (
                    <div>
                      <span className="font-semibold">Details:</span>{" "}
                      {typeof debugInfo.data.details === "object"
                        ? JSON.stringify(debugInfo.data.details)
                        : debugInfo.data.details}
                    </div>
                  )}

                  <details>
                    <summary className="cursor-pointer font-medium">Raw Response</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs overflow-auto max-h-[200px] p-2 bg-gray-100 rounded">
                      {debugInfo.raw}
                    </pre>
                  </details>

                  {debugInfo.convert && (
                    <details>
                      <summary className="cursor-pointer font-medium">Convert Response</summary>
                      <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                        <div>
                          <span className="font-semibold">Status:</span> {debugInfo.convert.status}{" "}
                          {debugInfo.convert.statusText}
                        </div>
                        {debugInfo.convert.data?.error && (
                          <div>
                            <span className="font-semibold">Error:</span> {debugInfo.convert.data.error}
                          </div>
                        )}
                        <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-[200px]">
                          {debugInfo.convert.raw}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Alert className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Accept this order</AlertTitle>
            <AlertDescription className="text-green-700">
              Accepting this order will change its status to &quot;Approved&quot; and notify the customer.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about accepting this order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Matching Customers section - moved above the checkbox and independent of it */}
          {hasMatchingCustomers && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Matching Customers Found</AlertTitle>
              <AlertDescription>
                There are existing customers with a matching email. Please select one to avoid creating duplicates.
              </AlertDescription>
            </Alert>
          )}

          {hasMatchingCustomers && (
            <div className="space-y-2">
              <Label htmlFor="customer-select">Select Existing Customer</Label>
              {isLoadingCustomers ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading customers...</span>
                </div>
              ) : (
                <Select
                  value={selectedCustomerId || ""}
                  onValueChange={(value) => {
                    setSelectedCustomerId(value === "none" ? null : value)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Select a customer --</SelectItem>
                    {matchingCustomers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        <div className="flex items-center">
                          <User className="mr-2 h-4 w-4" />
                          <span>{customer.customer_name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">({customer.email})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {selectedCustomer && (
                <div className="mt-2 p-2 bg-gray-50 rounded-md">
                  <p className="text-sm font-medium">Selected: {selectedCustomer.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="convert"
              checked={convertToCustomerOrder}
              onCheckedChange={(checked) => setConvertToCustomerOrder(checked as boolean)}
            />
            <Label htmlFor="convert" className="font-medium cursor-pointer">
              Convert to Customer Order
            </Label>
          </div>

          {convertToCustomerOrder && (
            <div className="space-y-4">
              <div className="pl-6 text-sm text-muted-foreground">
                This will create a new customer order based on this storefront order data.
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/storefront-orders")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Accept Order"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
