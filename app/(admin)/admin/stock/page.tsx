"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  AWAITING_DELIVERY: { label: "Awaiting Delivery", className: "bg-blue-100 text-blue-700" },
  IN_STOCK: { label: "In Stock", className: "bg-green-100 text-green-700" },
  SOLD: { label: "Sold", className: "bg-gray-100 text-gray-700" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-red-100 text-red-700" },
}

export default function StockRegisterPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const fetchStock = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "20")
      if (statusFilter) params.set("status", statusFilter)
      if (search) params.set("search", search)

      const res = await fetch(`/api/stock?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setVehicles(data.vehicles)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch {
      toast.error("Failed to load stock register")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => {
    fetchStock()
  }, [fetchStock])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, search])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Register</h1>
        <p className="text-sm text-muted-foreground">
          Track vehicle inventory and stock status
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="AWAITING_DELIVERY">Awaiting Delivery</SelectItem>
            <SelectItem value="IN_STOCK">In Stock</SelectItem>
            <SelectItem value="SOLD">Sold</SelectItem>
            <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
          </SelectContent>
        </Select>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search make, model, VIN..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-[250px]"
          />
          <Button type="submit" variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-muted-foreground">No vehicles found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Confirmation</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Acquired</th>
                  <th className="px-4 py-3 text-left font-medium">Stock Status</th>
                  <th className="px-4 py-3 text-right font-medium hidden lg:table-cell">Purchase Price</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v: any) => {
                  const ss = STATUS_STYLES[v.stockStatus] || STATUS_STYLES.AWAITING_DELIVERY
                  return (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-blue-600 hover:underline">
                          {v.year} {v.make} {v.model}
                        </Link>
                        <p className="text-xs text-muted-foreground">VIN: {v.vin}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {v.confirmationNumber}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                        {format(new Date(v.submittedAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", ss.className)}>
                          {ss.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell font-medium">
                        {v.purchasePrice ? `$${Number(v.purchasePrice).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
