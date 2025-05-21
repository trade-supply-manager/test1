"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useSupabase } from "@/contexts/supabase-context"
import {
  ClipboardCheck,
  Package,
  Users,
  ShoppingCart,
  Truck,
  Settings,
  LogOut,
  Factory,
  ChevronLeft,
  ChevronRight,
  Users2,
  CalendarClock,
  LineChart,
  ShoppingBag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type SidebarProps = {}

export function Sidebar({}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const { supabase } = useSupabase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const navGroups = [
    {
      title: "Overview",
      items: [
        {
          title: "Stock Levels",
          href: "/dashboard",
          icon: <ClipboardCheck className="h-5 w-5" />,
        },
        {
          title: "Delivery Conflicts",
          href: "/dashboard/deliveries",
          icon: <CalendarClock className="h-5 w-5" />,
        },
        {
          title: "Sales Analytics",
          href: "/dashboard/sales_analytics",
          icon: <LineChart className="h-5 w-5" />,
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          title: "Customers",
          href: "/dashboard/customers",
          icon: <Users className="h-5 w-5" />,
        },
        {
          title: "Customer Orders",
          href: "/dashboard/customer-orders",
          icon: <ShoppingCart className="h-5 w-5" />,
        },
        {
          title: "Storefront Orders",
          href: "/dashboard/storefront-orders",
          icon: <ShoppingBag className="h-5 w-5" />,
        },
        {
          title: "Purchase Orders",
          href: "/dashboard/purchase-orders",
          icon: <Truck className="h-5 w-5" />,
        },
      ],
    },
    {
      title: "Catalog",
      items: [
        {
          title: "Products",
          href: "/dashboard/products",
          icon: <Package className="h-5 w-5" />,
        },
        {
          title: "Manufacturers",
          href: "/dashboard/manufacturers",
          icon: <Factory className="h-5 w-5" />,
        },
      ],
    },
    {
      title: "Admin",
      items: [
        {
          title: "Employees",
          href: "/dashboard/employees",
          icon: <Users2 className="h-5 w-5" />,
        },
        {
          title: "Settings",
          href: "/dashboard/settings",
          icon: <Settings className="h-5 w-5" />,
        },
      ],
    },
  ]

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[#1D2545] text-white transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <Image
            src="https://kqtmzyfmhcnqwnyviodv.supabase.co/storage/v1/object/public/tsm-brand-material//Trade%20Supply%20Manager%20-%20final%20(1).png"
            alt="TSM Logo"
            width={150}
            height={40}
            className="object-contain"
          />
        )}
        {collapsed && (
          <Image
            src="https://kqtmzyfmhcnqwnyviodv.supabase.co/storage/v1/object/public/tsm-brand-material//TSM_-_body_logo__1_-removebg-preview.png"
            alt="TSM Logo"
            width={32}
            height={32}
            className="mx-auto object-contain"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-white hover:bg-gray-700"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-6 px-2">
          {navGroups.map((group) => {
            return (
              <div key={group.title} className="space-y-1">
                {!collapsed && (
                  <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.title}</h3>
                )}
                {collapsed && <div className="h-px bg-gray-700 mx-2 my-2" />}
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-gray-700 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white",
                    )}
                  >
                    {item.icon}
                    {!collapsed && <span className="ml-3">{item.title}</span>}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white w-full transition-colors",
            collapsed ? "justify-center" : "justify-start",
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="ml-3">Sign Out</span>}
        </button>
      </div>
    </div>
  )
}
