/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { Suspense } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Download,
} from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { RiskBadge } from "@/components/admin/RiskBadge"
import { VehicleActionCell } from "@/components/admin/VehicleActionCell"
import { VehicleFilterBar } from "@/components/admin/VehicleFilterBar"
import { cn } from "@/lib/utils"

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

const ALLOWED_SORT_COLUMNS = [
  "submittedAt",
  "confirmationNumber",
  "vin",
  "make",
  "model",
  "year",
  "sellerName",
  "status",
  "riskScore",
]

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const val = params[key]
  if (Array.isArray(val)) return val[0] || ""
  return val || ""
}

function buildUrl(
  currentParams: Record<string, string | string[] | undefined>,
  updates: Record<string, string>
): string {
  const params = new URLSearchParams()
  // Carry forward existing params
  for (const [key, val] of Object.entries(currentParams)) {
    const v = Array.isArray(val) ? val[0] : val
    if (v) params.set(key, v)
  }
  // Apply updates
  for (const [key, val] of Object.entries(updates)) {
    if (val) {
      params.set(key, val)
    } else {
      params.delete(key)
    }
  }
  const qs = params.toString()
  return `/admin/vehicles${qs ? `?${qs}` : ""}`
}

export default async function VehiclesListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const params = await searchParams

  const page = Math.max(1, parseInt(getParam(params, "page") || "1", 10))
  const limit = 20
  const status = getParam(params, "status")
  const source = getParam(params, "source")
  const riskLevel = getParam(params, "riskLevel")
  const search = getParam(params, "search")
  const dateFrom = getParam(params, "dateFrom")
  const dateTo = getParam(params, "dateTo")
  const rawSortBy = getParam(params, "sortBy") || "submittedAt"
  const sortBy = ALLOWED_SORT_COLUMNS.includes(rawSortBy)
    ? rawSortBy
    : "submittedAt"
  const sortOrder = getParam(params, "sortOrder") === "asc" ? "asc" : "desc"

  // Build Prisma where clause
  const where: any = {}

  if (status) where.status = status
  if (source) where.submissionSource = source

  if (riskLevel === "low") where.riskScore = { lte: 20 }
  else if (riskLevel === "medium") where.riskScore = { gt: 20, lte: 50 }
  else if (riskLevel === "high") where.riskScore = { gt: 50 }

  if (search) {
    where.OR = [
      { vin: { contains: search, mode: "insensitive" } },
      { registrationNumber: { contains: search, mode: "insensitive" } },
      { sellerName: { contains: search, mode: "insensitive" } },
      { confirmationNumber: { contains: search, mode: "insensitive" } },
    ]
  }

  if (dateFrom || dateTo) {
    where.submittedAt = {} as any
    if (dateFrom) where.submittedAt.gte = new Date(dateFrom)
    if (dateTo) where.submittedAt.lte = new Date(dateTo)
  }

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.vehicle.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  // Sort link helper
  function sortUrl(field: string): string {
    const isActive = sortBy === field
    const nextOrder = isActive && sortOrder === "desc" ? "asc" : "desc"
    return buildUrl(params, {
      sortBy: field,
      sortOrder: isActive ? nextOrder : "desc",
    })
  }

  function SortIcon({ field }: { field: string }) {
    if (sortBy !== field)
      return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-30" />
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3" />
    )
  }

  // CSV export URL with current filters
  const csvParams = new URLSearchParams()
  if (status) csvParams.set("status", status)
  if (source) csvParams.set("source", source)
  if (riskLevel) csvParams.set("riskLevel", riskLevel)
  if (search) csvParams.set("search", search)
  if (dateFrom) csvParams.set("dateFrom", dateFrom)
  if (dateTo) csvParams.set("dateTo", dateTo)
  const csvUrl = `/api/export/csv?${csvParams.toString()}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">All Vehicles</h1>
        <a
          href={csvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </a>
      </div>

      <Suspense
        fallback={
          <div className="h-10 animate-pulse rounded bg-gray-100" />
        }
      >
        <VehicleFilterBar />
      </Suspense>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Link
                  href={sortUrl("confirmationNumber")}
                  className="flex items-center font-medium"
                >
                  Ref # <SortIcon field="confirmationNumber" />
                </Link>
              </TableHead>
              <TableHead>
                <Link
                  href={sortUrl("vin")}
                  className="flex items-center font-medium"
                >
                  VIN <SortIcon field="vin" />
                </Link>
              </TableHead>
              <TableHead>
                <Link
                  href={sortUrl("make")}
                  className="flex items-center font-medium"
                >
                  Make/Model/Year <SortIcon field="make" />
                </Link>
              </TableHead>
              <TableHead>
                <Link
                  href={sortUrl("sellerName")}
                  className="flex items-center font-medium"
                >
                  Seller <SortIcon field="sellerName" />
                </Link>
              </TableHead>
              <TableHead>
                <Link
                  href={sortUrl("submittedAt")}
                  className="flex items-center font-medium"
                >
                  Submitted <SortIcon field="submittedAt" />
                </Link>
              </TableHead>
              <TableHead>Source</TableHead>
              <TableHead>
                <Link
                  href={sortUrl("status")}
                  className="flex items-center font-medium"
                >
                  Status <SortIcon field="status" />
                </Link>
              </TableHead>
              <TableHead>
                <Link
                  href={sortUrl("riskScore")}
                  className="flex items-center font-medium"
                >
                  Risk <SortIcon field="riskScore" />
                </Link>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-muted-foreground"
                >
                  No vehicles found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((v) => {
                const sourceBadge = SOURCE_BADGES[v.submissionSource]
                return (
                  <TableRow key={v.id}>
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
                      {sourceBadge && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            sourceBadge.className
                          )}
                        >
                          {sourceBadge.label}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={v.status} />
                    </TableCell>
                    <TableCell>
                      <RiskBadge score={v.riskScore} />
                    </TableCell>
                    <TableCell>
                      <VehicleActionCell id={v.id} status={v.status} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          {vehicles.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
          {Math.min(page * limit, total)} of {total} vehicles
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={buildUrl(params, { page: String(page - 1) })}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Link>
          ) : (
            <span
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors border border-input bg-background h-9 px-3 pointer-events-none opacity-50"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </span>
          )}
          <span className="text-sm tabular-nums">
            Page {page} of {totalPages || 1}
          </span>
          {page < totalPages ? (
            <Link
              href={buildUrl(params, { page: String(page + 1) })}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          ) : (
            <span
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors border border-input bg-background h-9 px-3 pointer-events-none opacity-50"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
