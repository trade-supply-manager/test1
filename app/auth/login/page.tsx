import type { Metadata } from "next"
import Image from "next/image"
import { AuthForm } from "@/components/auth-form"

export const metadata: Metadata = {
  title: "Login | Trade Supply Manager",
  description: "Login to your Trade Supply Manager account",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="bg-[#1D2545] rounded-full px-8 py-4 flex items-center justify-center mb-4">
            <Image
              src="https://kqtmzyfmhcnqwnyviodv.supabase.co/storage/v1/object/public/tsm-brand-material//Trade%20Supply%20Manager%20-%20final%20(1).png"
              alt="Trade Supply Manager Logo"
              width={220}
              height={70}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sign in</h1>
          <p className="text-sm text-gray-500">Enter your email below to sign in to your account</p>
        </div>
        <AuthForm mode="login" hideRegistrationLink={true} />
      </div>
    </div>
  )
}
