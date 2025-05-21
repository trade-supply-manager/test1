"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { Upload, X, Loader2, ImageIcon, Eye, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SettingsFormProps {
  initialSettings: any
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState({
    id: initialSettings?.id || "",
    storefront_image: initialSettings?.storefront_image || null,
    email_header_image: initialSettings?.email_header_image || null,
    email_sender: initialSettings?.email_sender || "",
    pdf_header_text: initialSettings?.pdf_header_text || "",
    pdf_logo_url: initialSettings?.pdf_logo_url || null,
  })

  // Preview states for uploaded images
  const [storefrontPreview, setStorefrontPreview] = useState<string | null>(settings.storefront_image)
  const [emailHeaderPreview, setEmailHeaderPreview] = useState<string | null>(settings.email_header_image)
  const [pdfLogoPreview, setPdfLogoPreview] = useState<string | null>(settings.pdf_logo_url)

  // PDF preview modal state
  const [isLogoPreviewOpen, setIsLogoPreviewOpen] = useState(false)

  // File upload states
  const [storefrontFile, setStorefrontFile] = useState<File | null>(null)
  const [emailHeaderFile, setEmailHeaderFile] = useState<File | null>(null)
  const [pdfLogoFile, setPdfLogoFile] = useState<File | null>(null)
  const [uploadingStorefront, setUploadingStorefront] = useState(false)
  const [uploadingEmailHeader, setUploadingEmailHeader] = useState(false)
  const [uploadingPdfLogo, setUploadingPdfLogo] = useState(false)

  // Format the sender preview
  const formatSenderPreview = (name: string) => {
    if (!name) return "Trade Supply Manager <orders@tradesupplymanager.com>"

    // If the name contains special characters that might cause issues, wrap it in quotes
    if (name.includes('"') || name.includes("'") || name.includes(",")) {
      // Replace double quotes with single quotes to avoid format issues
      name = name.replace(/"/g, "'")
      return `"${name}" <orders@tradesupplymanager.com>`
    }

    return `${name} <orders@tradesupplymanager.com>`
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSettings((prev) => ({ ...prev, [name]: value }))
  }

  const handleStorefrontImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setStorefrontFile(file)
      setStorefrontPreview(URL.createObjectURL(file))
    }
  }

  const handleEmailHeaderImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setEmailHeaderFile(file)
      setEmailHeaderPreview(URL.createObjectURL(file))
    }
  }

  const handlePdfLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"]

      if (!validImageTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an image file (JPEG, PNG, GIF, SVG, or WebP).",
          variant: "destructive",
        })
        return
      }
      setPdfLogoFile(file)
      setPdfLogoPreview(URL.createObjectURL(file))
    }
  }

  const uploadStorefrontImage = async () => {
    if (!storefrontFile) return null

    setUploadingStorefront(true)
    try {
      // Create a unique file name
      const fileExt = storefrontFile.name.split(".").pop()
      const fileName = `storefront-${Date.now()}.${fileExt}`
      const filePath = `settings/${fileName}`

      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage.from("tsm-public").upload(filePath, storefrontFile)

      if (uploadError) {
        throw uploadError
      }

      // Get the public URL
      const { data } = supabase.storage.from("tsm-public").getPublicUrl(filePath)
      return data.publicUrl
    } catch (error: any) {
      console.error("Error uploading storefront image:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "There was an error uploading the storefront image.",
        variant: "destructive",
      })
      return null
    } finally {
      setUploadingStorefront(false)
    }
  }

  const uploadEmailHeaderImage = async () => {
    if (!emailHeaderFile) return null

    setUploadingEmailHeader(true)
    try {
      // Create a unique file name
      const fileExt = emailHeaderFile.name.split(".").pop()
      const fileName = `email-header-${Date.now()}.${fileExt}`
      const filePath = `settings/${fileName}`

      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage.from("tsm-public").upload(filePath, emailHeaderFile)

      if (uploadError) {
        throw uploadError
      }

      // Get the public URL
      const { data } = supabase.storage.from("tsm-public").getPublicUrl(filePath)
      return data.publicUrl
    } catch (error: any) {
      console.error("Error uploading email header image:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "There was an error uploading the email header image.",
        variant: "destructive",
      })
      return null
    } finally {
      setUploadingEmailHeader(false)
    }
  }

  const uploadPdfLogo = async () => {
    if (!pdfLogoFile) return null

    setUploadingPdfLogo(true)
    try {
      // Create a unique file name
      const fileExt = pdfLogoFile.name.split(".").pop()
      const fileName = `pdf-logo-${Date.now()}.${fileExt}`
      const filePath = `settings/${fileName}`

      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage.from("tsm-public").upload(filePath, pdfLogoFile)

      if (uploadError) {
        throw uploadError
      }

      // Get the public URL
      const { data } = supabase.storage.from("tsm-public").getPublicUrl(filePath)
      return data.publicUrl
    } catch (error: any) {
      console.error("Error uploading PDF logo:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "There was an error uploading the logo image.",
        variant: "destructive",
      })
      return null
    } finally {
      setUploadingPdfLogo(false)
    }
  }

  const removeStorefrontImage = () => {
    setStorefrontFile(null)
    setStorefrontPreview(null)
    setSettings((prev) => ({ ...prev, storefront_image: null }))
  }

  const removeEmailHeaderImage = () => {
    setEmailHeaderFile(null)
    setEmailHeaderPreview(null)
    setSettings((prev) => ({ ...prev, email_header_image: null }))
  }

  const removePdfLogo = () => {
    setPdfLogoFile(null)
    setPdfLogoPreview(null)
    setSettings((prev) => ({ ...prev, pdf_logo_url: null }))
  }

  const toggleLogoPreview = () => {
    setIsLogoPreviewOpen(!isLogoPreviewOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Upload images if new ones were selected
      let storefrontUrl = settings.storefront_image
      let emailHeaderUrl = settings.email_header_image
      let pdfLogoUrl = settings.pdf_logo_url
      let uploadErrors = false

      if (storefrontFile) {
        const uploadedUrl = await uploadStorefrontImage()
        if (uploadedUrl) {
          storefrontUrl = uploadedUrl
        } else {
          uploadErrors = true
        }
      }

      if (emailHeaderFile) {
        const uploadedUrl = await uploadEmailHeaderImage()
        if (uploadedUrl) {
          emailHeaderUrl = uploadedUrl
        } else {
          uploadErrors = true
        }
      }

      if (pdfLogoFile) {
        const uploadedUrl = await uploadPdfLogo()
        if (uploadedUrl) {
          pdfLogoUrl = uploadedUrl
        } else {
          uploadErrors = true
        }
      }

      // If there were upload errors but we still want to save text settings
      if (uploadErrors) {
        const confirmSave = window.confirm("Some file uploads failed. Do you still want to save the other settings?")
        if (!confirmSave) {
          setIsLoading(false)
          return
        }
      }

      // Update settings in the database
      const { error } = await supabase.from("app_settings").upsert({
        id: settings.id || undefined,
        storefront_image: storefrontUrl,
        email_header_image: emailHeaderUrl,
        pdf_logo_url: pdfLogoUrl,
        email_sender: settings.email_sender,
        pdf_header_text: settings.pdf_header_text,
        date_last_updated: new Date().toISOString(),
      })

      if (error) {
        throw error
      }

      toast({
        title: uploadErrors ? "Settings Partially Updated" : "Settings Updated",
        description: uploadErrors
          ? "Text settings were saved, but some file uploads failed."
          : "Your settings have been successfully updated.",
      })

      router.refresh()
    } catch (error: any) {
      console.error("Error saving settings:", error)
      toast({
        title: "Update Failed",
        description: error.message || "There was an error updating your settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Tabs defaultValue="branding">
        <TabsList className="mb-4">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding Settings</CardTitle>
              <CardDescription>Customize your storefront appearance and branding elements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="storefront-image">Storefront Image</Label>
                <div className="flex flex-col space-y-4">
                  {storefrontPreview && (
                    <div className="relative w-full max-w-md">
                      <Image
                        src={storefrontPreview || "/placeholder.svg"}
                        alt="Storefront Preview"
                        width={400}
                        height={200}
                        className="rounded-md border object-contain"
                        style={{ maxHeight: "200px", width: "auto" }}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeStorefrontImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <Label
                      htmlFor="storefront-image-upload"
                      className="flex h-10 w-fit cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {uploadingStorefront ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload Image
                    </Label>
                    <Input
                      id="storefront-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleStorefrontImageChange}
                      disabled={uploadingStorefront}
                    />
                    <span className="text-sm text-muted-foreground">Recommended size: 1200 x 600 pixels</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>Configure how your emails appear to customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email-header-image">Email Header Image</Label>
                <div className="flex flex-col space-y-4">
                  {emailHeaderPreview && (
                    <div className="relative w-full max-w-md">
                      <Image
                        src={emailHeaderPreview || "/placeholder.svg"}
                        alt="Email Header Preview"
                        width={400}
                        height={150}
                        className="rounded-md border object-contain"
                        style={{ maxHeight: "150px", width: "auto" }}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeEmailHeaderImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <Label
                      htmlFor="email-header-image-upload"
                      className="flex h-10 w-fit cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {uploadingEmailHeader ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload Image
                    </Label>
                    <Input
                      id="email-header-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEmailHeaderImageChange}
                      disabled={uploadingEmailHeader}
                    />
                    <span className="text-sm text-muted-foreground">Recommended size: 600 x 200 pixels</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="email_sender">Email Sender Name</Label>
                <Input
                  id="email_sender"
                  name="email_sender"
                  placeholder="Your Company Name"
                  value={settings.email_sender}
                  onChange={handleInputChange}
                />
                <div className="mt-2">
                  <Alert variant="outline" className="bg-muted/50">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <AlertDescription>
                      <span className="font-medium">Email preview: </span>
                      <span className="font-mono text-sm">{formatSenderPreview(settings.email_sender)}</span>
                    </AlertDescription>
                  </Alert>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter your company or organization name. This will appear as the sender name for all outgoing emails.
                  The email address will always be <span className="font-mono">orders@tradesupplymanager.com</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf">
          <Card>
            <CardHeader>
              <CardTitle>PDF Settings</CardTitle>
              <CardDescription>Configure how your PDF documents appear to customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="pdf_header_text">PDF Header Text</Label>
                <Input
                  id="pdf_header_text"
                  name="pdf_header_text"
                  placeholder="Your Company Name"
                  value={settings.pdf_header_text}
                  onChange={handleInputChange}
                />
                <p className="text-sm text-muted-foreground">
                  This text will appear as the header in all generated PDF documents.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="pdf-logo">PDF Logo</Label>
                <div className="flex flex-col space-y-4">
                  {pdfLogoPreview && (
                    <div className="relative w-full max-w-md p-4 border rounded-md bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="h-8 w-8 text-blue-600" />
                        <span className="font-medium">Logo Preview</span>
                      </div>
                      <div className="flex gap-2">
                        {pdfLogoPreview && (
                          <div className="mt-2 mb-4">
                            <Image
                              src={pdfLogoPreview || "/placeholder.svg"}
                              alt="Logo Preview"
                              width={200}
                              height={100}
                              className="rounded-md border object-contain"
                              style={{ maxHeight: "100px", width: "auto" }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={toggleLogoPreview}>
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={removePdfLogo}>
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                      {isLogoPreviewOpen && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                          <div className="bg-white rounded-lg w-full max-w-3xl h-[80vh] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center">
                              <h3 className="text-lg font-medium">Logo Preview</h3>
                              <Button variant="ghost" size="sm" onClick={toggleLogoPreview}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex-1 overflow-hidden p-4 flex items-center justify-center">
                              <Image
                                src={pdfLogoPreview || "/placeholder.svg"}
                                alt="Logo Preview"
                                width={400}
                                height={300}
                                className="object-contain max-h-full"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <Label
                      htmlFor="pdf-logo-upload"
                      className="flex h-10 w-fit cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {uploadingPdfLogo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload Logo
                    </Label>
                    <Input
                      id="pdf-logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePdfLogoChange}
                      disabled={uploadingPdfLogo}
                    />
                    <span className="text-sm text-muted-foreground">Upload an image file for your company logo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This logo will be used in generated documents. For best results, use a high-resolution image with a
                    transparent background.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>
    </form>
  )
}
