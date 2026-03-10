"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Check,
  X,
  Trash2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  FileText,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { RiskBadge } from "@/components/admin/RiskBadge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface VehicleRow {
  id: string
  confirmationNumber: string
  vin: string
  make: string
  model: string
  year: number
  sellerName: string
  submittedAt: string
  submissionSource: string
  status: string
  riskScore: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
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

function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_BADGES[source] || {
    label: source,
    className: "bg-gray-100 text-gray-700 border-gray-200",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

type SortField =
  | "confirmationNumber"
  | "vin"
  | "make"
  | "sellerName"
  | "submittedAt"
  | "status"
  | "riskScore"

export function VehiclesTable() {
  const router = useRouter()

  // Data state
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [riskFilter, setRiskFilter] = useState<string>("")
  const [sourceFilter, setSourceFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Sort state
  const [sortBy, setSortBy] = useState<SortField>("submittedAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(pagination.page))
      params.set("limit", String(pagination.limit))
      params.set("sortBy", sortBy)
      params.set("sortOrder", sortOrder)

      if (statusFilter) params.set("status", statusFilter)
      if (riskFilter) params.set("riskLevel", riskFilter)
      if (sourceFilter) params.set("source", sourceFilter)
      if (searchQuery) params.set("search", searchQuery)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/vehicles?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch vehicles")

      const data = await res.json()
      setVehicles(data.vehicles)
      setPagination(data.pagination)
    } catch {
      toast.error("Failed to load vehicles")
    } finally {
      setLoading(false)
    }
  }, [
    pagination.page,
    pagination.limit,
    sortBy,
    sortOrder,
    statusFilter,
    riskFilter,
    sourceFilter,
    searchQuery,
    dateFrom,
    dateTo,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [statusFilter, riskFilter, sourceFilter, searchQuery, dateFrom, dateTo])

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field)
      return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-30" />
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3" />
    )
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === vehicles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(vehicles.map((v) => v.id)))
    }
  }

  async function handleApprove(id: string) {
    try {
      const res = await fetch(`/api/vehicles/${id}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to approve")
      toast.success("Vehicle approved")
      fetchData()
    } catch {
      toast.error("Failed to approve vehicle")
    }
  }

  async function handleReject(id: string) {
    const reason = prompt("Enter rejection reason:")
    if (!reason) return
    try {
      const res = await fetch(`/api/vehicles/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error("Failed to reject")
      toast.success("Vehicle rejected")
      fetchData()
    } catch {
      toast.error("Failed to reject vehicle")
    }
  }

  function handleExportCSV() {
    const params = new URLSearchParams()
    if (statusFilter) params.set("status", statusFilter)
    if (riskFilter) params.set("riskLevel", riskFilter)
    if (sourceFilter) params.set("source", sourceFilter)
    if (searchQuery) params.set("search", searchQuery)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    window.open(`/api/export/csv?${params.toString()}`, "_blank")
  }

  function handleExportSelected() {
    if (selectedIds.size === 0) {
      toast.error("No vehicles selected")
      return
    }
    // Export as CSV using current filters + IDs
    const selectedVehicles = vehicles.filter((v) => selectedIds.has(v.id))
    const headers = [
      "Ref#",
      "VIN",
      "Make",
      "Model",
      "Year",
      "Seller",
      "Status",
      "Risk Score",
      "Source",
      "Submitted",
    ]
    const rows = selectedVehicles.map((v) =>
      [
        v.confirmationNumber,
        v.vin,
        v.make,
        v.model,
        String(v.year),
        v.sellerName,
        v.status.replace(/_/g, " "),
        String(v.riskScore),
        v.submissionSource.replace(/_/g, " "),
        format(new Date(v.submittedAt), "yyyy-MM-dd"),
      ].join(",")
    )
    const csv = [headers.join(","), ...rows].join("\r\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vehicles-selected-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${selectedVehicles.length} vehicles`)
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) {
      toast.error("No vehicles selected")
      return
    }
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} selected vehicles?`
      )
    ) {
      return
    }
    toast.info(
      "Bulk delete is not yet implemented in the API. Please delete vehicles individually."
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto">
          <Select value={statusFilter || "all"} onValueChange={(val) => setStatusFilter(val === "all" ? "" : val)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING_VERIFICATION">Pending</SelectItem>
              <SelectItem value="DOCUMENTS_MISSING">Docs Missing</SelectItem>
              <SelectItem value="RISK_FLAGGED">Flagged</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[140px]"
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[140px]"
            placeholder="To"
          />
        </div>

        <Select value={riskFilter || "all"} onValueChange={(val) => setRiskFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="All Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter || "all"} onValueChange={(val) => setSourceFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="PUBLIC_PORTAL">Web Form</SelectItem>
            <SelectItem value="STAFF_ENTRY">Staff</SelectItem>
            <SelectItem value="SINGLE_USE_LINK">Sent Link</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search VIN, rego, seller name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={handleExportSelected}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export Selected
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.info("Excel export requires server-side generation. Use CSV export for now.")
            }}
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    vehicles.length > 0 && selectedIds.size === vehicles.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium"
                  onClick={() => handleSort("confirmationNumber")}
                >
                  Ref # <SortIcon field="confirmationNumber" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium"
                  onClick={() => handleSort("vin")}
                >
                  VIN <SortIcon field="vin" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium"
                  onClick={() => handleSort("make")}
                >
                  Make/Model/Year <SortIcon field="make" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium"
                  onClick={() => handleSort("sellerName")}
                >
                  Seller <SortIcon field="sellerName" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium"
                  onClick={() => handleSort("submittedAt")}
                >
                  Submitted <SortIcon field="submittedAt" />
                </button>
              </TableHead>
              <TableHead>Source</TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium"
                  onClick={() => handleSort("status")}
                >
                  Status <SortIcon field="status" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center font-medium"
                  onClick={() => handleSort("riskScore")}
                >
                  Risk <SortIcon field="riskScore" />
                </button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  No vehicles found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((v) => (
                <TableRow key={v.id} data-state={selectedIds.has(v.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(v.id)}
                      onCheckedChange={() => toggleSelect(v.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {v.confirmationNumber}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {v.vin}
                  </TableCell>
                  <TableCell>
                    {v.make} {v.model} ({v.year})
                  </TableCell>
                  <TableCell>{v.sellerName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(v.submittedAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={v.submissionSource} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={v.status} />
                  </TableCell>
                  <TableCell>
                    <RiskBadge score={v.riskScore} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          router.push(`/admin/vehicles/${v.id}`)
                        }
                        title="View"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => handleApprove(v.id)}
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleReject(v.id)}
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      {v.status === "APPROVED" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/api/vehicles/${v.id}/bill-of-sale`, '_blank')}
                          title="Bill of Sale"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
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
          Showing {vehicles.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}{" "}
          to {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} vehicles
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
