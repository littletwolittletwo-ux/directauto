"use client"

import { AlertTriangle } from "lucide-react"

function getGaugeColor(score: number): string {
  if (score <= 20) return "#22c55e"
  if (score <= 50) return "#f59e0b"
  return "#ef4444"
}

function getGaugeLabel(score: number): string {
  if (score <= 20) return "Low Risk"
  if (score <= 50) return "Medium Risk"
  return "High Risk"
}

export function RiskGauge({
  score,
  flags,
}: {
  score: number
  flags: string[]
}) {
  const clampedScore = Math.max(0, Math.min(100, score))
  const color = getGaugeColor(clampedScore)
  const label = getGaugeLabel(clampedScore)

  // SVG arc calculation
  const radius = 40
  const circumference = Math.PI * radius // Half circle
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Circular Gauge */}
      <div className="relative">
        <svg width="120" height="80" viewBox="0 0 120 80">
          {/* Background arc */}
          <path
            d="M 10 70 A 40 40 0 0 1 110 70"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Score arc */}
          <path
            d="M 10 70 A 40 40 0 0 1 110 70"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        {/* Center score */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color }}
          >
            {clampedScore}
          </span>
        </div>
      </div>

      <span className="text-xs font-medium text-muted-foreground">{label}</span>

      {/* Risk flags */}
      {flags.length > 0 && (
        <div className="flex w-full flex-col gap-1.5">
          {flags.map((flag, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{flag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
