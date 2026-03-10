"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  Plus,
  Link2,
  Download,
  ArrowRight,
  Copy,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { StatsCards } from "@/components/admin/StatsCards"
import {
  SubmissionsBarChart,
  StatusPieChart,
  RiskTrendChart,
} from "@/components/admin/Charts"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface DashboardStats {
  newToday: number
  pendingReview: number
  approvedThisWeek: number
  ppsrFlagged: number
  totalInDatabase: number
  avgRiskScore: number
  documentsMissing: number
  rejected: number
}

interface VehicleSummary {
  id: string
  confirmationNumber: string
  vin: string
  sellerName: string
  submittedAt: string
  submissionSource: string
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_VERIFICATION: "#eab308",
  DOCUMENTS_MISSING: "#f97316",
  RISK_FLAGGED: "#ef4444",
  APPROVED: "#22c55e",
  REJECTED: "#64748b",
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  PUBLIC_PORTAL: {
    label: "Web Form",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  STAFF_ENTRY: {
    label: "Staff",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  SINGLE_USE_LINK: {
    label: "Sent Link",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
}

export default function AdminDashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    newToday: 0,
    pendingReview: 0,
    approvedThisWeek: 0,
    ppsrFlagged: 0,
    totalInDatabase: 0,
    avgRiskScore: 0,
    documentsMissing: 0,
    rejected: 0,
  })
  const [recentVehicles, setRecentVehicles] = useState<VehicleSummary[]>([])
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>(
    []
  )
  const [statusData, setStatusData] = useState<
    { status: string; count: number; color: string }[]
  >([])
  const [riskTrend, setRiskTrend] = useState<
    { date: string; avgScore: number }[]
  >([])

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      try {
        // Fetch all vehicles to compute stats client-side
        const res = await fetch("/api/vehicles?limit=100&sortBy=submittedAt&sortOrder=desc")
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        const vehicles = data.vehicles as VehicleSummary[]

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(todayStart)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())

        // Compute stats
        const newToday = vehicles.filter(
          (v) => new Date(v.submittedAt) >= todayStart
        ).length
        const pendingReview = vehicles.filter(
          (v) => v.status === "PENDING_VERIFICATION"
        ).length
        const approvedThisWeek = vehicles.filter(
          (v) =>
            v.status === "APPROVED" && new Date(v.submittedAt) >= weekStart
        ).length
        const ppsrFlagged = vehicles.filter(
          (v) => v.status === "RISK_FLAGGED"
        ).length
        const totalInDatabase = data.pagination.total
        const docsMissing = vehicles.filter(
          (v) => v.status === "DOCUMENTS_MISSING"
        ).length
        const rejected = vehicles.filter(
          (v) => v.status === "REJECTED"
        ).length

        // Compute avg risk from available data
        const allVehicles = vehicles as (VehicleSummary & { riskScore?: number })[]
        const riskScores = allVehicles
          .map((v) => v.riskScore)
          .filter((s): s is number => typeof s === "number")
        const avgRisk =
          riskScores.length > 0
            ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length
            : 0

        setStats({
          newToday,
          pendingReview,
          approvedThisWeek,
          ppsrFlagged,
          totalInDatabase,
          avgRiskScore: avgRisk,
          documentsMissing: docsMissing,
          rejected,
        })

        // Recent submissions (last 10)
        setRecentVehicles(vehicles.slice(0, 10))

        // Build daily data for last 30 days
        const daily: Record<string, number> = {}
        for (let i = 29; i >= 0; i--) {
          const d = new Date(todayStart)
          d.setDate(d.getDate() - i)
          daily[d.toISOString().split("T")[0]] = 0
        }
        for (const v of vehicles) {
          const dateKey = new Date(v.submittedAt).toISOString().split("T")[0]
          if (dateKey in daily) {
            daily[dateKey]++
          }
        }
        setDailyData(
          Object.entries(daily).map(([date, count]) => ({ date, count }))
        )

        // Status breakdown
        const statusCounts: Record<string, number> = {}
        for (const v of vehicles) {
          statusCounts[v.status] = (statusCounts[v.status] || 0) + 1
        }
        setStatusData(
          Object.entries(STATUS_COLORS).map(([status, color]) => ({
            status,
            count: statusCounts[status] || 0,
            color,
          }))
        )

        // Risk trend (daily average, last 30 days)
        const riskByDate: Record<string, number[]> = {}
        for (const v of allVehicles) {
          const dateKey = new Date(v.submittedAt).toISOString().split("T")[0]
          if (typeof v.riskScore === "number") {
            if (!riskByDate[dateKey]) riskByDate[dateKey] = []
            riskByDate[dateKey].push(v.riskScore)
          }
        }
        const riskTrendData = Object.entries(daily)
          .map(([date]) => {
            const scores = riskByDate[date] || []
            return {
              date,
              avgScore:
                scores.length > 0
                  ? scores.reduce((a, b) => a + b, 0) / scores.length
                  : 0,
            }
          })
          .filter((d) => {
            const scores = riskByDate[d.date]
            return scores && scores.length > 0
          })
        setRiskTrend(riskTrendData)
      } catch {
        toast.error("Failed to load dashboard data")
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  async function handleCopyPublicLink() {
    const baseUrl = window.location.origin
    const url = `${baseUrl}/submit`
    await navigator.clipboard.writeText(url)
    toast.success("Public form link copied to clipboard")
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header greeting */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {getGreeting()}, {session?.user?.name || "there"} -- here&apos;s
          today at a glance
        </h1>
      </div>

      {/* KPI Cards */}
      <StatsCards stats={stats} />

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SubmissionsBarChart dailyData={dailyData} />
        <StatusPieChart statusData={statusData} />
        <RiskTrendChart riskTrend={riskTrend} />
      </div>

      {/* Recent submissions + Quick actions */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Recent feed (3/4 width) */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref #</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentVehicles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No submissions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentVehicles.map((v) => {
                    const source = SOURCE_BADGES[v.submissionSource]
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">
                          {v.confirmationNumber}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {v.vin}
                        </TableCell>
                        <TableCell>{v.sellerName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(
                            new Date(v.submittedAt),
                            "MMM d, h:mm a"
                          )}
                        </TableCell>
                        <TableCell>
                          {source && (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                source.className
                              )}
                            >
                              {source.label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={v.status} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(`/admin/vehicles/${v.id}`)
                            }
                          >
                            Review
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Quick actions (1/4 width) */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/vehicles/new"
              className={cn(buttonVariants(), "w-full justify-start")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle Manually
            </Link>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCopyPublicLink}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Public Form Link
            </Button>

            <a
              href="/api/export/csv"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full justify-start"
              )}
            >
              <Download className="mr-2 h-4 w-4" />
              Export All CSV
            </a>

            <Link
              href="/admin/vehicles"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full justify-start"
              )}
            >
              <Link2 className="mr-2 h-4 w-4" />
              View All Vehicles
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
