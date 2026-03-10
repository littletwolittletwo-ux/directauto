"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditTimeline } from "@/components/admin/AuditTimeline"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface AuditLogEntry {
  id: string
  action: string
  createdAt: string
  user?: { name: string } | null
  details?: Record<string, unknown> | null
}

export default function VehicleAuditPage() {
  const params = useParams()
  const vehicleId = params.id as string

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [vehicleRef, setVehicleRef] = useState("")
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [auditRes, vehicleRes] = await Promise.all([
        fetch(`/api/audit?vehicleId=${vehicleId}&limit=100`),
        fetch(`/api/vehicles/${vehicleId}`),
      ])

      if (auditRes.ok) {
        const data = await auditRes.json()
        setLogs(data.logs)
      }

      if (vehicleRes.ok) {
        const vehicle = await vehicleRes.json()
        setVehicleRef(
          `${vehicle.confirmationNumber} - ${vehicle.make} ${vehicle.model} (${vehicle.year})`
        )
      }
    } catch {
      toast.error("Failed to load audit log")
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/vehicles/${vehicleId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Vehicle
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Audit Log</h1>
          {vehicleRef && (
            <p className="text-sm text-muted-foreground">{vehicleRef}</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            All Activity
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({logs.length} entries)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline logs={logs} />
        </CardContent>
      </Card>
    </div>
  )
}
