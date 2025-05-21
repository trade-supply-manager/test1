import { cn } from "@/lib/utils"

interface NavBadgeProps {
  count: number
  collapsed?: boolean
}

export function NavBadge({ count, collapsed = false }: NavBadgeProps) {
  if (count <= 0) return null

  return (
    <span
      className={cn(
        "bg-red-600 text-white text-xs font-medium rounded-full flex items-center justify-center",
        collapsed ? "ml-auto w-5 h-5" : "ml-2 px-2 py-0.5 min-w-[20px]",
      )}
      aria-label={`${count} items`}
    >
      {count}
    </span>
  )
}
