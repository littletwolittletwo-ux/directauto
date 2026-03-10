"use client"

import { cn } from "@/lib/utils"

function getRiskLevel(score: number): {
  label: string
  className: string
} {
  if (score <= 20) {
    return {
      label: "Low",
      className: "bg-green-100 text-green-800 border-green-200",
    }
  }
  if (score <= 50) {
    return {
      label: "Medium",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    }
  }
  return {
    label: "High",
    className: "bg-red-100 text-red-800 border-red-200",
  }
}

export function RiskBadge({ score }: { score: number }) {
  const { label, className } = getRiskLevel(score)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        className
      )}
    >
      {label}
    </span>
  )
}
