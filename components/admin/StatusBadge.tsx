"use client"

import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING_VERIFICATION: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  DOCUMENTS_MISSING: {
    label: "Docs Missing",
    className: "bg-orange-500 text-white border-orange-600",
  },
  RISK_FLAGGED: {
    label: "Flagged",
    className: "bg-red-500 text-white border-red-600",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-green-500 text-white border-green-600",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-slate-500 text-white border-slate-600",
  },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, " "),
    className: "bg-gray-100 text-gray-800 border-gray-200",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
