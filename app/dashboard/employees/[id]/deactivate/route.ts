import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })

  // Check if we have a session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If no session, return unauthorized
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const { error } = await supabase
      .from("employees")
      .update({
        is_active: false,
        date_last_updated: new Date().toISOString(),
        updated_by_user_id: session.user.id,
      })
      .eq("id", params.id)

    if (error) throw error

    return NextResponse.redirect(new URL(`/dashboard/employees/${params.id}`, request.url))
  } catch (error) {
    console.error("Error deactivating employee:", error)
    return new NextResponse("Error deactivating employee", { status: 500 })
  }
}
