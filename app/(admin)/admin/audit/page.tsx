"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface AuditLogEntry {
  id: string
  action: string
  createdAt: string
  ipAddress: string | null
  user: { id: string; name: string; email: string } | null
  vehicle: {
    id: string
    vin: string
    confirmationNumber: string
    make: string
    model: string
  } | null
  details: Record<string, unknown> | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const ACTION_TYPES = [
  "VEHICLE_SUBMITTED",
  "VEHICLE_UPDATED",
  "VEHICLE_APPROVED",
  "VEHICLE_REJECTED",
  "PPSR_UPDATED",
  "LINK_GENERATED",
  "DOCUMENT_UPLOADED",
  "IDENTITY_VERIFIED",
  "NOTE_ADDED",
  "SETTINGS_UPDATED",
]

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details || Object.keys(details).length === 0) return "-"

  if (details.reason) return `Reason: ${details.reason}`
  if (details.previousStatus)
    return `From: ${String(details.previousStatus).replace(/_/g, " ")}`
  if (details.confirmationNumber)
    return `Ref: ${details.confirmationNumber}`
  if (details.source)
    return `Source: ${String(details.source).replace(/_/g, " ")}`

  // Summarize field changes
  const parts: string[] = []
  for (const [key, val] of Object.entries(details)) {
    if (typeof val === "object" && val !== null && "from" in val && "to" in val) {
      const change = val as { from: unknown; to: unknown }
      parts.push(`${key}: ${String(change.from)} -> ${String(change.to)}`)
    }
  }
  return parts.length > 0 ? parts.join("; ") : JSON.stringify(details).slice(0, 80)
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(pagination.page))
      params.set("limit", String(pagination.limit))
      if (searchQuery) params.set("search", searchQuery)
      if (actionFilter) params.set("action", actionFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/audit?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch")

      const data = await res.json()
      setLogs(data.logs)
      setPagination(data.pagination)
    } catch {
      toast.error("Failed to load audit logs")
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, searchQuery, actionFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [searchQuery, actionFilter, dateFrom, dateTo])

  function handleExportCSV() {
    const headers = [
      "Timestamp",
      "User",
      "Vehicle Ref",
      "Action",
      "Details",
      "IP Address",
    ]
    const rows = logs.map((log) =>
      [
        format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss"),
        log.user?.name || "-",
        log.vehicle?.confirmationNumber || "-",
        formatAction(log.action),
        formatDetails(log.details),
        log.ipAddress || "-",
      ]
        .map((val) => {
          const str = String(val)
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(",")
    )
    const csv = [headers.join(","), ...rows].join("\r\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Audit log exported")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Audit Log</h1>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              ({pagination.total} entries)
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, VIN, or ref number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={actionFilter || "all"} onValueChange={(val) => setActionFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {ACTION_TYPES.map((action) => (
              <SelectItem key={action} value={action}>
                {formatAction(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[140px]"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[140px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Vehicle Ref</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No audit log entries found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(
                      new Date(log.createdAt),
                      "MMM d, yyyy h:mm a"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.user?.name || (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.vehicle ? (
                      <a
                        href={`/admin/vehicles/${log.vehicle.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {log.vehicle.confirmationNumber}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatAction(log.action)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {formatDetails(log.details)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.ipAddress || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          {logs.length > 0
            ? (pagination.page - 1) * pagination.limit + 1
            : 0}{" "}
          to {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
          of {pagination.total} entries
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
            }
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm tabular-nums">
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
            }
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
