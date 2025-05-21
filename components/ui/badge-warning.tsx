import { AlertTriangle, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface InventoryStatusBadgeProps {
  quantity: number
  warningThreshold: number
  criticalThreshold: number
}

export function InventoryStatusBadge({ quantity, warningThreshold, criticalThreshold }: InventoryStatusBadgeProps) {
  const isCritical = quantity <= criticalThreshold
  const isWarning = quantity <= warningThreshold && quantity > criticalThreshold

  if (isCritical) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1 bg-red-600">
        <AlertCircle className="h-3 w-3" />
        Critical
      </Badge>
    )
  }

  if (isWarning) {
    return (
      <Badge variant="warning" className="flex items-center gap-1 bg-amber-500">
        <AlertTriangle className="h-3 w-3" />
        Warning
      </Badge>
    )
  }

  return null
}
