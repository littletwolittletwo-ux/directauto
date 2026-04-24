"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CheckCircle2, XCircle, RotateCcw, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface HistoryEntry {
  id: string
  action: string
  comment: string | null
  createdAt: string
  user: { id: string; name: string; email: string } | null
}

const ACTION_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  submitted: {
    icon: Clock,
    label: "Submitted for review",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  approved: {
    icon: CheckCircle2,
    label: "Approved",
    color: "text-green-600 bg-green-50 border-green-200",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    color: "text-red-600 bg-red-50 border-red-200",
  },
  resubmitted: {
    icon: RotateCcw,
    label: "Resubmitted for review",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
}

export function ApprovalHistoryTimeline({
  vehicleId,
}: {
  vehicleId: string
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/vehicles/${vehicleId}/approval/history`
        )
        if (!res.ok) return
        const data = await res.json()
        setHistory(data)
      } catch {
        // Non-critical — fail silently
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [vehicleId])

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No approval history yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {history.map((entry, i) => {
        const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.submitted
        const Icon = config.icon

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  config.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {i < history.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="pb-3">
              <p className="text-sm font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">
                {entry.user?.name || "System"} &middot;{" "}
                {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
              {entry.comment && (
                <p className="mt-1 text-sm text-muted-foreground italic">
                  &ldquo;{entry.comment}&rdquo;
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
