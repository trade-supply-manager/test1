"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase-client"
import { AlertTriangle, Mail, Users, Building, Star } from "lucide-react"

function isValidUUID(id: any): boolean {
  if (typeof id !== "string") {
    return false
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

interface EmailRecipientsTabProps {
  customerId: string
  orderId: string
  selectedContactIds: string[]
  onContactsChange: (contactIds: string[], includePrimaryContact: boolean) => void
  selectedEmployeeIds?: string[]
  onEmployeesChange?: (employeeIds: string[]) => void
  onSendEmail?: () => void
  isSending?: boolean
  customerEmail?: string | null
  customerName?: string | null
  enableEmailNotifications: boolean
  onToggleEmailNotifications: (enabled: boolean) => void
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
}

interface Employee {
  id: string
  employee_name: string
  email: string
  department: string | null
  role: string | null
  is_active: boolean | null
}

interface EmailLog {
  id: string
  created_at: string
  recipients: string
  subject: string
  status: string
  error?: string
}

export function EmailRecipientsTab({
  customerId,
  orderId,
  selectedContactIds,
  onContactsChange,
  selectedEmployeeIds = [],
  onEmployeesChange = () => {},
  onSendEmail,
  isSending = false,
  customerEmail = null,
  customerName = null,
  enableEmailNotifications,
  onToggleEmailNotifications,
}: EmailRecipientsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true)
  const [primaryCustomerEmail, setPrimaryCustomerEmail] = useState<string | null>(customerEmail)
  const [primaryCustomerName, setPrimaryCustomerName] = useState<string | null>(customerName)
  const [includePrimaryContact, setIncludePrimaryContact] = useState<boolean>(true)
  const [debugInfo, setDebugInfo] = useState<string>("")

  // Add a ref to track if we've initialized the component
  const isInitialized = useRef(false)

  // Add validation for orderId
  useEffect(() => {
    if (orderId && !isValidUUID(orderId)) {
      console.warn(`EmailRecipientsTab received invalid orderId: ${JSON.stringify(orderId)}`)
    }
  }, [orderId])

  // Fetch customer contacts and primary contact info
  useEffect(() => {
    async function fetchContacts() {
      if (!customerId || !enableEmailNotifications) {
        setContacts([])
        setIsLoadingContacts(false)
        return
      }

      setIsLoadingContacts(true)
      try {
        const supabase = getSupabaseClient()

        // Fetch customer email and name
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("email, customer_name")
          .eq("id", customerId)
          .single()

        if (customerError) {
          console.error("Error fetching customer data:", customerError)
        } else if (customerData?.email) {
          console.log("Found primary customer email:", customerData.email)
          setPrimaryCustomerEmail(customerData.email)
          setPrimaryCustomerName(customerData.customer_name)
        } else {
          console.warn("No email found for customer ID:", customerId)
        }

        // Fetch contacts
        const { data, error } = await supabase
          .from("customer_contacts")
          .select("id, first_name, last_name, email, phone_number")
          .eq("customer_id", customerId)
          .eq("is_archived", false)
          .order("last_name", { ascending: true })

        if (error) {
          console.error("Error fetching contacts:", error)
          return
        }

        console.log(`Found ${data?.length || 0} contacts for customer:`, customerId)
        setContacts(data || [])
      } catch (error) {
        console.error("Error in fetchContacts:", error)
      } finally {
        setIsLoadingContacts(false)
      }
    }

    fetchContacts()
  }, [customerId, customerEmail, customerName, enableEmailNotifications])

  // Fetch employees
  useEffect(() => {
    async function fetchEmployees() {
      if (!enableEmailNotifications) {
        setEmployees([])
        setIsLoadingEmployees(false)
        return
      }

      setIsLoadingEmployees(true)
      try {
        const supabase = getSupabaseClient()

        // Fetch active employees
        const { data, error } = await supabase
          .from("employees")
          .select("id, employee_name, email, department, role, is_active")
          .eq("is_active", true)
          .order("employee_name", { ascending: true })

        if (error) {
          console.error("Error fetching employees:", error)
          return
        }

        console.log(`Found ${data?.length || 0} active employees`)
        setEmployees(data || [])

        if (data && data.length > 0 && selectedEmployeeIds.length === 0) {
          // Auto-select all employees on initial load
          console.log("Auto-selecting all employees")
          const allEmployeeIds = data.map((employee) => employee.id)
          onEmployeesChange(allEmployeeIds)
        }
      } catch (error) {
        console.error("Error in fetchEmployees:", error)
      } finally {
        setIsLoadingEmployees(false)
      }
    }

    fetchEmployees()
  }, [enableEmailNotifications, onEmployeesChange, selectedEmployeeIds.length])

  // Immediately notify parent of primary contact inclusion state on mount and when it changes
  useEffect(() => {
    // Only update the parent if we've initialized the component
    if (isInitialized.current) {
      // Ensure parent component knows about primary contact inclusion
      console.log("Updating parent with contact selection:", {
        selectedContactIds,
        includePrimaryContact,
      })
      onContactsChange(selectedContactIds, includePrimaryContact)
    } else {
      // Mark as initialized after the first render
      isInitialized.current = true
    }

    // Log current state for debugging
    console.log("📧 EmailRecipientsTab state:", {
      customerId,
      primaryEmail: primaryCustomerEmail,
      includePrimary: includePrimaryContact,
      selectedContacts: selectedContactIds,
      selectedEmployees: selectedEmployeeIds,
    })

    // Update debug info
    setDebugInfo(
      JSON.stringify(
        {
          customerId,
          primaryEmail: primaryCustomerEmail,
          includePrimary: includePrimaryContact,
          selectedContacts: selectedContactIds,
          selectedEmployees: selectedEmployeeIds,
        },
        null,
        2,
      ),
    )
  }, [
    customerId,
    includePrimaryContact,
    onContactsChange,
    primaryCustomerEmail,
    selectedContactIds,
    selectedEmployeeIds,
  ])

  const handleContactToggle = useCallback(
    (contactId: string) => {
      const updatedSelection = selectedContactIds.includes(contactId)
        ? selectedContactIds.filter((id) => id !== contactId)
        : [...selectedContactIds, contactId]

      console.log("Contact toggle:", contactId, "New selection:", updatedSelection)
      onContactsChange(updatedSelection, includePrimaryContact)
    },
    [includePrimaryContact, onContactsChange, selectedContactIds],
  )

  const handleEmployeeToggle = useCallback(
    (employeeId: string) => {
      const updatedSelection = selectedEmployeeIds.includes(employeeId)
        ? selectedEmployeeIds.filter((id) => id !== employeeId)
        : [...selectedEmployeeIds, employeeId]

      console.log("Employee toggle:", employeeId, "New selection:", updatedSelection)
      onEmployeesChange(updatedSelection)
    },
    [onEmployeesChange, selectedEmployeeIds],
  )

  const handleSelectAllContacts = useCallback(() => {
    if (selectedContactIds.length === contacts.length) {
      // If all are selected, deselect all
      console.log("Deselecting all contacts")
      onContactsChange([], includePrimaryContact)
    } else {
      // Otherwise, select all
      console.log("Selecting all contacts")
      onContactsChange(
        contacts.map((contact) => contact.id),
        includePrimaryContact,
      )
    }
  }, [contacts, includePrimaryContact, onContactsChange, selectedContactIds.length])

  const handleSelectAllEmployees = useCallback(() => {
    if (selectedEmployeeIds.length === employees.length) {
      // If all are selected, deselect all
      console.log("Deselecting all employees")
      onEmployeesChange([])
    } else {
      // Otherwise, select all
      console.log("Selecting all employees")
      onEmployeesChange(employees.map((employee) => employee.id))
    }
  }, [employees, onEmployeesChange, selectedEmployeeIds.length])

  const handlePrimaryContactToggle = useCallback(
    (checked: boolean) => {
      console.log("Primary contact toggle changed:", checked)
      setIncludePrimaryContact(checked)

      // Ensure we call the parent callback with the updated value
      onContactsChange(selectedContactIds, checked)

      // Log the current state after update
      console.log("Updated state - Include primary:", checked)
      console.log("Selected contact IDs:", selectedContactIds)
    },
    [onContactsChange, selectedContactIds],
  )

  // Function to handle the send email button click with additional validation
  const handleSendEmail = useCallback(() => {
    // Check if we have any recipients
    const hasRecipients =
      selectedContactIds.length > 0 ||
      selectedEmployeeIds.length > 0 ||
      (includePrimaryContact && !!primaryCustomerEmail)

    if (!hasRecipients) {
      console.error("No recipients selected for email")
      alert("Please select at least one recipient or include the primary contact")
      return
    }

    console.log("Sending email with:", {
      includePrimaryContact,
      primaryEmail: primaryCustomerEmail,
      selectedContacts: selectedContactIds,
      selectedEmployees: selectedEmployeeIds,
    })

    // Call the parent's onSendEmail function
    if (onSendEmail) {
      onSendEmail()
    }
  }, [includePrimaryContact, onSendEmail, primaryCustomerEmail, selectedContactIds, selectedEmployeeIds])

  if (!customerId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Recipients</CardTitle>
          <CardDescription>Select contacts to receive order notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6 text-center text-muted-foreground">
            <p>Please select a customer to view available contacts</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications Toggle */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>Enable or disable email notifications for this order</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-email-notifications"
              checked={enableEmailNotifications}
              onCheckedChange={(checked) => onToggleEmailNotifications(!!checked)}
            />
            <Label htmlFor="enable-email-notifications" className="font-medium">
              Enable email notifications for this order
            </Label>
          </div>
          {!enableEmailNotifications && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                <p>Email notifications are currently disabled. No emails will be sent for this order.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {enableEmailNotifications && (
        <>
          {/* Customer Recipients Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customer Recipients
                </CardTitle>
                <CardDescription>Select customer contacts to receive order notifications</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingContacts ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Primary Contact Section */}
                  {primaryCustomerEmail && (
                    <div className="p-3 border rounded-md bg-blue-50 mb-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="primary-contact"
                          checked={includePrimaryContact}
                          onCheckedChange={(checked) => handlePrimaryContactToggle(!!checked)}
                        />
                        <div className="grid gap-0.5">
                          <Label htmlFor="primary-contact" className="font-medium flex items-center">
                            {primaryCustomerName || "Primary Contact"}
                            <Star className="h-4 w-4 ml-2 text-amber-500 fill-amber-500" />
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            <div>{primaryCustomerEmail}</div>
                            <div className="text-xs text-blue-600 mt-1">Primary contact from customer record</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional Contacts Section */}
                  {contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center border rounded-md border-dashed">
                      <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                      <p className="text-muted-foreground">No additional contacts found for this customer</p>
                      {!primaryCustomerEmail && (
                        <p className="text-sm text-red-500 mt-2">
                          No primary email found for this customer. Please add a contact or update the customer record.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2 pb-2 border-b">
                        <Checkbox
                          id="select-all-contacts"
                          checked={selectedContactIds.length === contacts.length && contacts.length > 0}
                          onCheckedChange={handleSelectAllContacts}
                        />
                        <Label htmlFor="select-all-contacts" className="font-medium">
                          Select All Additional Contacts
                        </Label>
                      </div>

                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div key={contact.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                            <Checkbox
                              id={`contact-${contact.id}`}
                              checked={selectedContactIds.includes(contact.id)}
                              onCheckedChange={() => handleContactToggle(contact.id)}
                            />
                            <div className="grid gap-0.5">
                              <Label htmlFor={`contact-${contact.id}`} className="font-medium">
                                {contact.first_name} {contact.last_name}
                              </Label>
                              <div className="text-sm text-muted-foreground">
                                {contact.email && <div>{contact.email}</div>}
                                {contact.phone_number && <div>{contact.phone_number}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employee CC Recipients Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Employee CC Recipients
                </CardTitle>
                <CardDescription>Select employees to CC on order notifications</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingEmployees ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center border rounded-md border-dashed">
                  <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                  <p className="text-muted-foreground">No active employees found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      id="select-all-employees"
                      checked={selectedEmployeeIds.length === employees.length && employees.length > 0}
                      onCheckedChange={handleSelectAllEmployees}
                    />
                    <Label htmlFor="select-all-employees" className="font-medium">
                      Select All
                    </Label>
                  </div>

                  <div className="space-y-2">
                    {employees.map((employee) => (
                      <div key={employee.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                        <Checkbox
                          id={`employee-${employee.id}`}
                          checked={selectedEmployeeIds.includes(employee.id)}
                          onCheckedChange={() => handleEmployeeToggle(employee.id)}
                        />
                        <div className="grid gap-0.5">
                          <Label htmlFor={`employee-${employee.id}`} className="font-medium">
                            {employee.employee_name}
                            {employee.role && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                {employee.role}
                              </span>
                            )}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {employee.email && <div>{employee.email}</div>}
                            {employee.department && <div>Department: {employee.department}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Debug Information Card (only visible when DEBUG_EMAIL is enabled) */}
          {process.env.DEBUG_EMAIL === "true" && (
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle>Debug Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">{debugInfo}</pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
