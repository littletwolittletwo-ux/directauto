"use client"

import {
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Database,
  BarChart3,
  FileX,
  XCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface StatsData {
  newToday: number
  pendingReview: number
  approvedThisWeek: number
  ppsrFlagged: number
  totalInDatabase: number
  avgRiskScore: number
  documentsMissing: number
  rejected: number
}

interface TrendConfig {
  icon: React.ElementType
  label: string
  key: keyof StatsData
  color: string
  bgColor: string
}

const cards: TrendConfig[] = [
  {
    icon: PlusCircle,
    label: "New Today",
    key: "newToday",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    icon: Clock,
    label: "Pending Review",
    key: "pendingReview",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
  },
  {
    icon: CheckCircle2,
    label: "Approved This Week",
    key: "approvedThisWeek",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    icon: AlertTriangle,
    label: "PPSR Flagged",
    key: "ppsrFlagged",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  {
    icon: Database,
    label: "Total in Database",
    key: "totalInDatabase",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    icon: BarChart3,
    label: "Avg Risk Score",
    key: "avgRiskScore",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    icon: FileX,
    label: "Documents Missing",
    key: "documentsMissing",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    icon: XCircle,
    label: "Rejected",
    key: "rejected",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
  },
]

export function StatsCards({ stats }: { stats: StatsData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        const value = stats[card.key]

        return (
          <Card key={card.key}>
            <CardContent className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.bgColor}`}
              >
                <Icon className={`h-4.5 w-4.5 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">
                  {card.label}
                </p>
                <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">
                  {typeof value === "number" && card.key === "avgRiskScore"
                    ? value.toFixed(1)
                    : value}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
