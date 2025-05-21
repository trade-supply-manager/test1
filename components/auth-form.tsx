"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
// REMOVE: import { useAuthClient } from "@/hooks/use-auth-client" - This file doesn't exist

// Use the correct import from our context
import { useAuth } from "@/contexts/supabase-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"

interface AuthFormProps {
  mode: "login" | "register"
  hideRegistrationLink?: boolean
}

export function AuthForm({ mode, hideRegistrationLink = false }: AuthFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Use the useAuth hook directly from our context
  const { signIn, signUp, isLoading } = useAuth()

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Get error from URL if present
  const urlError = searchParams?.get("error")
  const urlMessage = searchParams?.get("message")
  const redirectPath = searchParams?.get("redirect")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      console.log("Authentication attempt:", {
        mode,
        email,
        time: new Date().toISOString(),
      })

      if (mode === "login") {
        await signIn(email, password)

        // Show success toast with explicit duration
        toast({
          title: "Success",
          description: "You have been signed in successfully.",
        })

        // Delay navigation to ensure toast is displayed
        setTimeout(() => {
          if (redirectPath) {
            router.push(redirectPath)
          }
        }, 800)
      } else {
        await signUp(email, password)

        // Show success toast with explicit duration
        toast({
          title: "Success",
          description: "Your account has been created. Please check your email for verification.",
          duration: 3000,
        })

        // Delay navigation to ensure toast is displayed
        setTimeout(() => {
          router.push("/auth/verification-sent")
        }, 800)
      }
    } catch (err: any) {
      console.error("Authentication error:", err.message)
      setError(err.message || "An error occurred during authentication")

      // Show error toast with longer duration
      toast({
        title: "Authentication Error",
        description: err.message || "An error occurred during authentication",
        variant: "destructive",
        duration: 4000,
      })
    }
  }

  return (
    <div className="mt-6">
      {(urlError || urlMessage) && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{urlMessage || "An error occurred. Please try again."}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : mode === "login" ? (
            "Sign In"
          ) : (
            "Sign Up"
          )}
        </Button>
      </form>

      {!hideRegistrationLink && mode === "login" && (
        <div className="mt-4 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
            Sign up
          </Link>
        </div>
      )}

      {mode === "register" && (
        <div className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </div>
      )}
    </div>
  )
}
