"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase-client"
import { AlertTriangle, Mail, Users, Building, Star } from "lucide-react"
import { log, LogLevel } from "@/lib/debug-utils"

function isValidUUID(id: any): boolean {
  if (typeof id !== "string") {
    return false
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

interface EmailRecipientsTabProps {
  manufacturerId: string
  orderId: string
  selectedContactIds: string[]
  onContactsChange: (contactIds: string[], includePrimaryContact: boolean) => void
  selectedEmployeeIds: string[]
  onEmployeesChange: (employeeIds: string[]) => void
  onSendEmail?: (customMessage?: string, subject?: string) => void
  isSending?: boolean
  manufacturerEmail?: string | null
  manufacturerName?: string | null
  enableEmailNotifications: boolean
  onToggleEmailNotifications: (enabled: boolean) => void
  defaultSubject?: string
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

export function EmailRecipientsTab({
  manufacturerId,
  orderId,
  selectedContactIds,
  onContactsChange,
  selectedEmployeeIds = [],
  onEmployeesChange = () => {},
  onSendEmail,
  isSending = false,
  manufacturerEmail = null,
  manufacturerName = null,
  enableEmailNotifications,
  onToggleEmailNotifications,
  defaultSubject = "",
}: EmailRecipientsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true)
  const [primaryManufacturerEmail, setPrimaryManufacturerEmail] = useState<string | null>(manufacturerEmail)
  const [primaryManufacturerName, setPrimaryManufacturerName] = useState<string | null>(manufacturerName)
  const [includePrimaryContact, setIncludePrimaryContact] = useState<boolean>(true)
  const [customMessage, setCustomMessage] = useState("")
  const [emailSubject, setEmailSubject] = useState(defaultSubject)

  // Refs to track initialization and prevent infinite loops
  const hasAutoSelectedEmployees = useRef(false)
  const isInitialized = useRef(false)
  const prevContactIdsRef = useRef<string[]>([])
  const prevIncludePrimaryRef = useRef<boolean>(true)
  const prevManufacturerId = useRef<string | null>(null)
  const employeesInitialized = useRef(false)

  // Update email subject when defaultSubject changes
  useEffect(() => {
    if (defaultSubject && !emailSubject) {
      setEmailSubject(defaultSubject)
    }
  }, [defaultSubject, emailSubject])

  // Fetch manufacturer contacts and primary contact info
  useEffect(() => {
    // Skip if manufacturer ID hasn't changed
    if (prevManufacturerId.current === manufacturerId) {
      return
    }

    prevManufacturerId.current = manufacturerId

    async function fetchContacts() {
      if (!manufacturerId || !enableEmailNotifications) {
        setContacts([])
        setIsLoadingContacts(false)
        return
      }

      setIsLoadingContacts(true)
      try {
        const supabase = getSupabaseClient()

        // Fetch manufacturer email and name
        const { data: manufacturerData, error: manufacturerError } = await supabase
          .from("manufacturers")
          .select("email, manufacturer_name")
          .eq("id", manufacturerId)
          .single()

        if (manufacturerError) {
          log(LogLevel.ERROR, "EmailRecipientsTab", "Error fetching manufacturer data", manufacturerError)
        } else if (manufacturerData?.email) {
          log(LogLevel.DEBUG, "EmailRecipientsTab", "Found primary manufacturer email:", manufacturerData.email)
          setPrimaryManufacturerEmail(manufacturerData.email)
          setPrimaryManufacturerName(manufacturerData.manufacturer_name)
        } else {
          log(LogLevel.WARN, "EmailRecipientsTab", "No email found for manufacturer ID:", manufacturerId)
        }

        // Fetch contacts
        const { data, error } = await supabase
          .from("manufacturer_contacts")
          .select("id, first_name, last_name, email, phone_number")
          .eq("manufacturer_id", manufacturerId)
          .eq("is_archived", false)
          .order("last_name", { ascending: true })

        if (error) {
          log(LogLevel.ERROR, "EmailRecipientsTab", "Error fetching contacts", error)
          return
        }

        log(
          LogLevel.DEBUG,
          "EmailRecipientsTab",
          `Found ${data?.length || 0} contacts for manufacturer:`,
          manufacturerId,
        )
        setContacts(data || [])
      } catch (error) {
        log(LogLevel.ERROR, "EmailRecipientsTab", "Exception in fetchContacts", error)
      } finally {
        setIsLoadingContacts(false)
      }
    }

    fetchContacts()
  }, [manufacturerId, enableEmailNotifications])

  // Update component when manufacturer email/name props change
  useEffect(() => {
    if (manufacturerEmail !== primaryManufacturerEmail) {
      setPrimaryManufacturerEmail(manufacturerEmail)
    }
    if (manufacturerName !== primaryManufacturerName) {
      setPrimaryManufacturerName(manufacturerName)
    }
  }, [manufacturerEmail, manufacturerName, primaryManufacturerEmail, primaryManufacturerName])

  // Fetch employees - OPTIMIZED to prevent infinite loops
  useEffect(() => {
    // Skip if notifications are disabled or if we've already fetched employees
    if (!enableEmailNotifications || employeesInitialized.current) {
      return
    }

    async function fetchEmployees() {
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
          log(LogLevel.ERROR, "EmailRecipientsTab", "Error fetching employees", error)
          return
        }

        log(LogLevel.DEBUG, "EmailRecipientsTab", `Found ${data?.length || 0} active employees`)
        setEmployees(data || [])

        // Auto-select all employees ONLY if:
        // 1. We have employee data
        // 2. No employees are currently selected
        // 3. We haven't auto-selected before
        if (
          data &&
          data.length > 0 &&
          selectedEmployeeIds.length === 0 &&
          !hasAutoSelectedEmployees.current &&
          !orderId
        ) {
          log(LogLevel.DEBUG, "EmailRecipientsTab", "Auto-selecting all employees")
          const allEmployeeIds = data.map((employee) => employee.id)
          onEmployeesChange(allEmployeeIds)

          // Mark that we've auto-selected employees
          hasAutoSelectedEmployees.current = true
        }

        // Mark employees as initialized
        employeesInitialized.current = true
      } catch (error) {
        log(LogLevel.ERROR, "EmailRecipientsTab", "Exception in fetchEmployees", error)
      } finally {
        setIsLoadingEmployees(false)
      }
    }

    fetchEmployees()
  }, [enableEmailNotifications, onEmployeesChange, selectedEmployeeIds.length, orderId])

  // Handle contact selection changes
  useEffect(() => {
    // Only update the parent if we've initialized the component and if the values have changed
    if (isInitialized.current) {
      // Use a ref to track previous values to avoid unnecessary updates
      if (
        JSON.stringify(prevContactIdsRef.current) !== JSON.stringify(selectedContactIds) ||
        prevIncludePrimaryRef.current !== includePrimaryContact
      ) {
        // Update refs with current values
        prevContactIdsRef.current = [...selectedContactIds]
        prevIncludePrimaryRef.current = includePrimaryContact

        // Log the update for debugging
        log(LogLevel.DEBUG, "EmailRecipientsTab", "Updating parent with contact selection:", {
          selectedContactIds,
          includePrimaryContact,
        })
      }
    } else {
      // Mark as initialized after the first render
      isInitialized.current = true

      // Initialize the refs
      prevContactIdsRef.current = [...selectedContactIds]
      prevIncludePrimaryRef.current = includePrimaryContact
    }
  }, [includePrimaryContact, selectedContactIds])

  const handleContactToggle = useCallback(
    (contactId: string) => {
      const updatedSelection = selectedContactIds.includes(contactId)
        ? selectedContactIds.filter((id) => id !== contactId)
        : [...selectedContactIds, contactId]

      log(LogLevel.DEBUG, "EmailRecipientsTab", "Contact toggle:", contactId, "New selection:", updatedSelection)
      onContactsChange(updatedSelection, includePrimaryContact)
    },
    [includePrimaryContact, onContactsChange, selectedContactIds],
  )

  const handleEmployeeToggle = useCallback(
    (employeeId: string) => {
      const updatedSelection = selectedEmployeeIds.includes(employeeId)
        ? selectedEmployeeIds.filter((id) => id !== employeeId)
        : [...selectedEmployeeIds, employeeId]

      log(LogLevel.DEBUG, "EmailRecipientsTab", "Employee toggle:", employeeId, "New selection:", updatedSelection)
      onEmployeesChange(updatedSelection)
    },
    [onEmployeesChange, selectedEmployeeIds],
  )

  const handleSelectAllContacts = useCallback(() => {
    if (selectedContactIds.length === contacts.length) {
      // If all are selected, deselect all
      log(LogLevel.DEBUG, "EmailRecipientsTab", "Deselecting all contacts")
      onContactsChange([], includePrimaryContact)
    } else {
      // Otherwise, select all
      log(LogLevel.DEBUG, "EmailRecipientsTab", "Selecting all contacts")
      onContactsChange(
        contacts.map((contact) => contact.id),
        includePrimaryContact,
      )
    }
  }, [contacts, includePrimaryContact, onContactsChange, selectedContactIds.length])

  const handleSelectAllEmployees = useCallback(() => {
    if (selectedEmployeeIds.length === employees.length) {
      // If all are selected, deselect all
      log(LogLevel.DEBUG, "EmailRecipientsTab", "Deselecting all employees")
      onEmployeesChange([])
    } else {
      // Otherwise, select all
      log(LogLevel.DEBUG, "EmailRecipientsTab", "Selecting all employees")
      onEmployeesChange(employees.map((employee) => employee.id))
    }
  }, [employees, onEmployeesChange, selectedEmployeeIds.length])

  const handlePrimaryContactToggle = useCallback(
    (checked: boolean) => {
      log(LogLevel.DEBUG, "EmailRecipientsTab", "Primary contact toggle changed:", checked)
      setIncludePrimaryContact(checked)
      onContactsChange(selectedContactIds, checked)
    },
    [onContactsChange, selectedContactIds],
  )

  const handleSendEmail = useCallback(() => {
    // Check if we have any recipients
    const hasRecipients =
      selectedContactIds.length > 0 ||
      selectedEmployeeIds.length > 0 ||
      (includePrimaryContact && !!primaryManufacturerEmail)

    if (!hasRecipients) {
      log(LogLevel.ERROR, "EmailRecipientsTab", "No recipients selected for email")
      alert("Please select at least one recipient or include the primary contact")
      return
    }

    log(LogLevel.INFO, "EmailRecipientsTab", "Sending email with:", {
      includePrimaryContact,
      primaryEmail: primaryManufacturerEmail,
      selectedContacts: selectedContactIds,
      selectedEmployees: selectedEmployeeIds,
    })

    // Call the parent's onSendEmail function
    if (onSendEmail) {
      onSendEmail(customMessage, emailSubject)
    }
  }, [
    includePrimaryContact,
    onSendEmail,
    primaryManufacturerEmail,
    selectedContactIds,
    selectedEmployeeIds,
    customMessage,
    emailSubject,
  ])

  // Log component state for debugging
  useEffect(() => {
    log(LogLevel.DEBUG, "EmailRecipientsTab", "📧 EmailRecipientsTab state:", {
      primaryEmail: primaryManufacturerEmail,
      includePrimary: includePrimaryContact,
      selectedContacts: selectedContactIds,
      selectedEmployees: selectedEmployeeIds,
    })
  }, [primaryManufacturerEmail, includePrimaryContact, selectedContactIds, selectedEmployeeIds])

  if (!manufacturerId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Recipients</CardTitle>
          <CardDescription>Select contacts to receive order notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6 text-center text-muted-foreground">
            <p>Please select a manufacturer to view available contacts</p>
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
          {/* Manufacturer Recipients Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Manufacturer Recipients
                </CardTitle>
                <CardDescription>Select manufacturer contacts to receive order notifications</CardDescription>
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
                  {primaryManufacturerEmail && (
                    <div className="p-3 border rounded-md bg-blue-50 mb-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="primary-contact"
                          checked={includePrimaryContact}
                          onCheckedChange={(checked) => handlePrimaryContactToggle(!!checked)}
                        />
                        <div className="grid gap-0.5">
                          <Label htmlFor="primary-contact" className="font-medium flex items-center">
                            {primaryManufacturerName || "Primary Contact"}
                            <Star className="h-4 w-4 ml-2 text-amber-500 fill-amber-500" />
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            <div>{primaryManufacturerEmail}</div>
                            <div className="text-xs text-blue-600 mt-1">Primary contact from manufacturer record</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional Contacts Section */}
                  {contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center border rounded-md border-dashed">
                      <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                      <p className="text-muted-foreground">No additional contacts found for this manufacturer</p>
                      {!primaryManufacturerEmail && (
                        <p className="text-sm text-red-500 mt-2">
                          No primary email found for this manufacturer. Please add a contact or update the manufacturer
                          record.
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
            {}
          </Card>
        </>
      )}
    </div>
  )
}
