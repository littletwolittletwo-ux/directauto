"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect, useTransition } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

export function VehicleFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "")

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    if (!("page" in updates)) params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get("search") || ""
      if (searchInput !== currentSearch) {
        updateParams({ search: searchInput })
      }
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  return (
    <div className={`flex flex-wrap items-end gap-3 ${isPending ? "opacity-60" : ""}`}>
      <div className="w-full sm:w-auto">
        <Select
          value={searchParams.get("status") || "all"}
          onValueChange={(val) => updateParams({ status: val === "all" ? "" : val })}
        >
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
          value={searchParams.get("dateFrom") || ""}
          onChange={(e) => updateParams({ dateFrom: e.target.value })}
          className="w-[140px]"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={searchParams.get("dateTo") || ""}
          onChange={(e) => updateParams({ dateTo: e.target.value })}
          className="w-[140px]"
        />
      </div>

      <Select
        value={searchParams.get("riskLevel") || "all"}
        onValueChange={(val) => updateParams({ riskLevel: val === "all" ? "" : val })}
      >
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

      <Select
        value={searchParams.get("source") || "all"}
        onValueChange={(val) => updateParams({ source: val === "all" ? "" : val })}
      >
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8"
        />
      </div>
    </div>
  )
}
