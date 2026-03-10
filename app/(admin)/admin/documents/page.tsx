"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import {
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface DocumentEntry {
  id: string
  category: string
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
  uploadedById: string | null
  vehicleId: string
  vehicle: {
    id: string
    confirmationNumber: string
    make: string
    model: string
    year: number
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  licence_front: "Licence Front",
  licence_back: "Licence Back",
  selfie: "Selfie",
  ownership: "Ownership",
  ppsr_certificate: "PPSR Certificate",
  other: "Other",
}

export default function DocumentVaultPage() {
  const [documents, setDocuments] = useState<DocumentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [vehicleSearch, setVehicleSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      // We fetch vehicles with documents included, then flatten
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("limit", "100")
      if (vehicleSearch) params.set("search", vehicleSearch)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/vehicles?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch")

      const data = await res.json()
      const allDocs: DocumentEntry[] = []

      for (const vehicle of data.vehicles) {
        // Fetch full vehicle to get documents
        const vRes = await fetch(`/api/vehicles/${vehicle.id}`)
        if (!vRes.ok) continue
        const vData = await vRes.json()

        for (const doc of vData.documents || []) {
          if (categoryFilter && doc.category !== categoryFilter) continue
          allDocs.push({
            ...doc,
            vehicle: {
              id: vData.id,
              confirmationNumber: vData.confirmationNumber,
              make: vData.make,
              model: vData.model,
              year: vData.year,
            },
          })
        }
      }

      // Sort by date desc
      allDocs.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )

      const perPage = 20
      setTotalPages(Math.ceil(allDocs.length / perPage) || 1)
      setDocuments(allDocs.slice((page - 1) * perPage, page * perPage))
    } catch {
      toast.error("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [vehicleSearch, categoryFilter, dateFrom, dateTo, page])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  useEffect(() => {
    setPage(1)
  }, [vehicleSearch, categoryFilter, dateFrom, dateTo])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Document Vault</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by vehicle VIN, rego, or seller..."
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={categoryFilter || "all"} onValueChange={(val) => setCategoryFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="licence_front">Licence Front</SelectItem>
            <SelectItem value="licence_back">Licence Back</SelectItem>
            <SelectItem value="selfie">Selfie</SelectItem>
            <SelectItem value="ownership">Ownership</SelectItem>
            <SelectItem value="ppsr_certificate">PPSR Certificate</SelectItem>
            <SelectItem value="other">Other</SelectItem>
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

      {/* Document grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No documents found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <div className="relative flex h-32 items-center justify-center bg-muted/50">
                {doc.mimeType.startsWith("image/") ? (
                  <img
                    src={`/api/documents/${doc.id}`}
                    alt={doc.originalName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileText className="h-12 w-12 text-red-400" />
                )}
              </div>
              <CardContent className="space-y-1.5 pt-3">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                  {CATEGORY_LABELS[doc.category] || doc.category}
                </span>
                <p className="truncate text-sm font-medium">
                  {doc.originalName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {doc.vehicle.confirmationNumber} - {doc.vehicle.make}{" "}
                  {doc.vehicle.model}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(`/api/documents/${doc.id}`, "_blank")
                    }
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Preview
                  </Button>
                  <a
                    href={`/api/documents/${doc.id}`}
                    download={doc.originalName}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Download
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && documents.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
