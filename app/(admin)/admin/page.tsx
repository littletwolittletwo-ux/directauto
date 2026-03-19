import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { Plus, Link2, Download, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { StatsCards } from "@/components/admin/StatsCards"
import {
  SubmissionsBarChart,
  StatusPieChart,
  RiskTrendChart,
} from "@/components/admin/Charts"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { CopyLinkButton } from "@/components/admin/CopyLinkButton"
import { cn } from "@/lib/utils"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

const STATUS_COLORS: Record<string, string> = {
  PENDING_VERIFICATION: "#eab308",
  DOCUMENTS_MISSING: "#f97316",
  RISK_FLAGGED: "#ef4444",
  APPROVED: "#22c55e",
  REJECTED: "#64748b",
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

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function AdminDashboardPage() {
  let session;
  try {
    session = await getServerSession(authOptions)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return <div className="p-8 text-red-600 font-mono text-sm whitespace-pre-wrap">SESSION ERROR: {msg}</div>
  }
  if (!session) redirect("/login")

  let vehicles: Awaited<ReturnType<typeof prisma.vehicle.findMany>> = []
  let totalCount = 0
  let dbError = ""

  try {
    const [v, c] = await Promise.all([
      prisma.vehicle.findMany({
        orderBy: { submittedAt: "desc" },
        take: 100,
        include: {
          ppsrCheck: { select: { isWrittenOff: true, isStolen: true, hasFinance: true, status: true } },
        },
      }),
      prisma.vehicle.count(),
    ])
    vehicles = v
    totalCount = c
  } catch (err) {
    dbError = err instanceof Error ? err.stack || err.message : String(err)
    console.error('DB QUERY ERROR:', dbError)
  }

  if (dbError) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-xl font-bold text-red-600">Database Query Failed</h1>
        <pre className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800 whitespace-pre-wrap overflow-auto max-h-96">{dbError}</pre>
        <p className="text-sm text-gray-600">Session: {session?.user?.email || "unknown"}</p>
        <p className="text-sm text-gray-600">DATABASE_URL set: {!!process.env.DATABASE_URL ? "yes" : "no"}</p>
      </div>
    )
  }

  console.log('DB QUERY RESULT:', vehicles.length, totalCount)

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())

  const stats = {
    newToday: vehicles.filter((v) => new Date(v.submittedAt) >= todayStart)
      .length,
    pendingReview: vehicles.filter(
      (v) => v.status === "PENDING_VERIFICATION"
    ).length,
    approvedThisWeek: vehicles.filter(
      (v) =>
        v.status === "APPROVED" && new Date(v.submittedAt) >= weekStart
    ).length,
    ppsrFlagged: vehicles.filter((v) => v.status === "RISK_FLAGGED").length,
    totalInDatabase: totalCount,
    avgRiskScore:
      vehicles.length > 0
        ? vehicles.reduce((a, v) => a + v.riskScore, 0) / vehicles.length
        : 0,
    documentsMissing: vehicles.filter(
      (v) => v.status === "DOCUMENTS_MISSING"
    ).length,
    rejected: vehicles.filter((v) => v.status === "REJECTED").length,
  }

  const recentVehicles = vehicles.slice(0, 10)

  // Build daily data for last 30 days
  const daily: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - i)
    daily[d.toISOString().split("T")[0]] = 0
  }
  for (const v of vehicles) {
    const dateKey = new Date(v.submittedAt).toISOString().split("T")[0]
    if (dateKey in daily) daily[dateKey]++
  }
  const dailyData = Object.entries(daily).map(([date, count]) => ({
    date,
    count,
  }))

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  for (const v of vehicles) {
    statusCounts[v.status] = (statusCounts[v.status] || 0) + 1
  }
  const statusData = Object.entries(STATUS_COLORS).map(([status, color]) => ({
    status,
    count: statusCounts[status] || 0,
    color,
  }))

  // Risk trend
  const riskByDate: Record<string, number[]> = {}
  for (const v of vehicles) {
    const dateKey = new Date(v.submittedAt).toISOString().split("T")[0]
    if (!riskByDate[dateKey]) riskByDate[dateKey] = []
    riskByDate[dateKey].push(v.riskScore)
  }
  const riskTrend = Object.entries(daily)
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
    .filter((d) => (riskByDate[d.date]?.length ?? 0) > 0)

  const userName = session?.user?.name || "there"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {getGreeting()}, {userName} -- here&apos;s today at a glance
        </h1>
      </div>

      <StatsCards stats={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <SubmissionsBarChart dailyData={dailyData} />
        <StatusPieChart statusData={statusData} />
        <RiskTrendChart riskTrend={riskTrend} />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref #</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead className="text-right">Buy</TableHead>
                  <TableHead className="text-right">Sell</TableHead>
                  <TableHead>PPSR</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentVehicles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No submissions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentVehicles.map((v) => {
                    const ppsr = (v as any).ppsrCheck
                    let ppsrLabel = '—'
                    let ppsrClass = 'text-gray-400'
                    if (ppsr?.status === 'COMPLETED') {
                      if (ppsr.isStolen) { ppsrLabel = 'Stolen'; ppsrClass = 'text-red-700 bg-red-50 border-red-200' }
                      else if (ppsr.isWrittenOff) { ppsrLabel = 'W/Off'; ppsrClass = 'text-red-700 bg-red-50 border-red-200' }
                      else if (ppsr.hasFinance) { ppsrLabel = 'Finance'; ppsrClass = 'text-orange-700 bg-orange-50 border-orange-200' }
                      else { ppsrLabel = 'Clear'; ppsrClass = 'text-green-700 bg-green-50 border-green-200' }
                    }
                    const riskColor = v.riskScore === 0 ? 'text-gray-400'
                      : v.riskScore <= 20 ? 'text-green-600'
                      : v.riskScore <= 50 ? 'text-yellow-600'
                      : 'text-red-600'
                    const buyPrice = (v as any).offerPrice
                    const sellPrice = v.sellerPrice
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">
                          {v.confirmationNumber}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{v.year} {v.make} {v.model}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {v.vin}
                        </TableCell>
                        <TableCell className="text-sm">{v.sellerName}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {buyPrice ? `$${Number(buyPrice).toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {sellPrice ? `$${Number(sellPrice).toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell>
                          {ppsrLabel !== '—' ? (
                            <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium", ppsrClass)}>
                              {ppsrLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-sm font-semibold", riskColor)}>
                            {v.riskScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={v.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(v.submittedAt), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/vehicles/${v.id}`}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                          >
                            Review
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/vehicles/new"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full justify-start"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle Manually
            </Link>

            <CopyLinkButton />

            <a
              href="/api/export/csv"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full justify-start"
            >
              <Download className="mr-2 h-4 w-4" />
              Export All CSV
            </a>

            <Link
              href="/admin/vehicles"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full justify-start"
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
