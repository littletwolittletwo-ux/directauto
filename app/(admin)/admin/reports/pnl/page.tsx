"use client"

import { useState, useEffect, useCallback } from "react"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import {
  Loader2,
  Download,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Search,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const PRESETS: Record<string, () => { from: string; to: string }> = {
  this_month: () => {
    const now = new Date()
    return {
      from: format(startOfMonth(now), "yyyy-MM-dd"),
      to: format(endOfMonth(now), "yyyy-MM-dd"),
    }
  },
  last_month: () => {
    const last = subMonths(new Date(), 1)
    return {
      from: format(startOfMonth(last), "yyyy-MM-dd"),
      to: format(endOfMonth(last), "yyyy-MM-dd"),
    }
  },
  this_quarter: () => {
    const now = new Date()
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
    return { from: format(qStart, "yyyy-MM-dd"), to: format(qEnd, "yyyy-MM-dd") }
  },
  this_year: () => {
    const now = new Date()
    return {
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    }
  },
}

export default function PnLReportPage() {
  const defaultRange = PRESETS.this_month()
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [vehicleSearch, setVehicleSearch] = useState("")

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/pnl?from=${dateFrom}&to=${dateTo}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setReport(data)
    } catch {
      toast.error("Failed to load P&L report")
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  function handlePreset(key: string) {
    if (key === "custom") return
    const range = PRESETS[key]?.()
    if (range) {
      setDateFrom(range.from)
      setDateTo(range.to)
    }
  }

  // Merge revenue & cost by month for chart
  const chartData = (() => {
    if (!report) return []
    const months = new Set<string>()
    report.revenue.byMonth.forEach((r: any) => months.add(r.month))
    report.costs.byMonth.forEach((c: any) => months.add(c.month))

    return Array.from(months)
      .sort()
      .map((m) => ({
        month: m,
        revenue: (report.revenue.byMonth.find((r: any) => r.month === m)?.amountCents || 0) / 100,
        costs: (report.costs.byMonth.find((c: any) => c.month === m)?.amountCents || 0) / 100,
      }))
  })()

  const filteredVehicles = report?.perVehicle?.filter((v: any) =>
    vehicleSearch
      ? v.vehicleDescription.toLowerCase().includes(vehicleSearch.toLowerCase())
      : true
  ) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">P&L Report</h1>
        <p className="text-sm text-muted-foreground">
          Profit and loss across all vehicle applications
        </p>
      </div>

      {/* Date range controls */}
      <div className="flex flex-wrap items-end gap-3">
        <Select onValueChange={handlePreset}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Date preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[150px]"
          />
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() =>
              window.open(`/api/reports/pnl/csv?from=${dateFrom}&to=${dateTo}`, "_blank")
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !report ? (
        <p className="text-center text-muted-foreground py-12">
          No data available
        </p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Total Revenue
                </div>
                <p className="text-2xl font-bold mt-1">
                  {formatDollars(report.revenue.totalCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {report.revenue.invoiceCount} invoice{report.revenue.invoiceCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown className="h-4 w-4" />
                  Total Costs
                </div>
                <p className="text-2xl font-bold mt-1">
                  {formatDollars(report.costs.totalCents)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Gross Profit
                </div>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    report.grossProfitCents >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatDollars(report.grossProfitCents)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Gross Margin
                </div>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    (report.grossMarginPercent ?? 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {report.grossMarginPercent !== null
                    ? `${report.grossMarginPercent}%`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly trend chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Monthly Revenue vs Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) =>
                        `$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                      }
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
                    <Bar dataKey="costs" fill="#ef4444" name="Costs" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Costs by category */}
          {report.costs.byCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Costs by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium">Category</th>
                        <th className="px-4 py-2 text-right font-medium">Amount</th>
                        <th className="px-4 py-2 text-right font-medium">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.costs.byCategory.map((c: any) => (
                        <tr key={c.categoryName} className="border-b last:border-0">
                          <td className="px-4 py-2">{c.categoryName}</td>
                          <td className="px-4 py-2 text-right font-medium">
                            {formatDollars(c.amountCents)}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {report.costs.totalCents > 0
                              ? `${((c.amountCents / report.costs.totalCents) * 100).toFixed(1)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-vehicle breakdown */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Per-Vehicle Breakdown</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vehicle..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="pl-8 w-[200px] h-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Vehicle</th>
                      <th className="px-4 py-2 text-right font-medium">Revenue</th>
                      <th className="px-4 py-2 text-right font-medium">Cost</th>
                      <th className="px-4 py-2 text-right font-medium">Margin $</th>
                      <th className="px-4 py-2 text-right font-medium">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          No vehicles in this period
                        </td>
                      </tr>
                    ) : (
                      filteredVehicles.map((v: any) => (
                        <tr key={v.vehicleId} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2 max-w-[250px] truncate">
                            {v.vehicleDescription}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {v.revenueCents > 0 ? formatDollars(v.revenueCents) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {v.costCents > 0 ? formatDollars(v.costCents) : "—"}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-medium ${
                              v.marginCents >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {formatDollars(v.marginCents)}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {v.marginPercent !== null ? `${v.marginPercent}%` : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
