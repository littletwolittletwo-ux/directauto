"use client"

import { format } from "date-fns"

interface AuditLogEntry {
  id: string
  action: string
  createdAt: string
  user?: { name: string } | null
  details?: Record<string, unknown> | null
}

const ACTION_COLORS: Record<string, string> = {
  VEHICLE_SUBMITTED: "bg-blue-500",
  VEHICLE_UPDATED: "bg-amber-500",
  VEHICLE_APPROVED: "bg-green-500",
  VEHICLE_REJECTED: "bg-red-500",
  PPSR_UPDATED: "bg-purple-500",
  LINK_GENERATED: "bg-cyan-500",
  DOCUMENT_UPLOADED: "bg-indigo-500",
  IDENTITY_VERIFIED: "bg-emerald-500",
  NOTE_ADDED: "bg-gray-500",
  SETTINGS_UPDATED: "bg-orange-500",
  INSPECTION_NOTE_ADDED: "bg-teal-500",
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatDetails(details: Record<string, unknown> | null | undefined): string | null {
  if (!details || Object.keys(details).length === 0) return null

  const parts: string[] = []

  if (details.reason) {
    parts.push(`Reason: ${details.reason}`)
  }
  if (details.previousStatus) {
    parts.push(
      `Previous status: ${String(details.previousStatus).replace(/_/g, " ")}`
    )
  }
  if (details.source) {
    parts.push(`Source: ${String(details.source).replace(/_/g, " ")}`)
  }
  if (details.confirmationNumber) {
    parts.push(`Ref: ${details.confirmationNumber}`)
  }

  if (parts.length === 0) {
    // Summarize field changes
    for (const [key, val] of Object.entries(details)) {
      if (
        typeof val === "object" &&
        val !== null &&
        "from" in val &&
        "to" in val
      ) {
        const change = val as { from: unknown; to: unknown }
        parts.push(`${key}: ${String(change.from)} -> ${String(change.to)}`)
      }
    }
  }

  return parts.length > 0 ? parts.join("; ") : null
}

export function AuditTimeline({ logs }: { logs: AuditLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No audit history yet.
      </p>
    )
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

      {logs.map((log) => {
        const dotColor =
          ACTION_COLORS[log.action] || "bg-gray-400"
        const detailText = formatDetails(log.details)

        return (
          <div key={log.id} className="relative flex gap-3 pb-4">
            {/* Dot */}
            <div
              className={`relative z-10 mt-1.5 h-[18px] w-[18px] shrink-0 rounded-full border-2 border-white ${dotColor}`}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  {formatAction(log.action)}
                </span>
                {log.user?.name && (
                  <span className="text-xs text-muted-foreground">
                    by {log.user.name}
                  </span>
                )}
              </div>
              {detailText && (
                <p className="mt-0.5 text-xs text-muted-foreground break-words">
                  {detailText}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
