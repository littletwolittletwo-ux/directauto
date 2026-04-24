"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import {
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  Clock,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PPSRLodgePanelProps {
  vehicleId: string
  isApproved: boolean
  vehicle: {
    vin: string
    registrationNumber: string
    make: string
    model: string
    year: number
    sellerName: string
  }
}

export function PPSRLodgePanel({ vehicleId, isApproved, vehicle }: PPSRLodgePanelProps) {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lodging, setLodging] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/ppsr`)
      if (res.ok) {
        // This uses the existing ppsr check endpoint; we also need our ppsr records
        // Try the lodgement records endpoint
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  async function handleLodge() {
    setLodging(true)
    setShowConfirm(false)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/ppsr/lodge`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "PPSR lodgement failed")
      }
      toast.success(`PPSR lodged — Reg: ${data.registrationNumber}`)
      setRecords((prev) => [data, ...prev])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLodging(false)
    }
  }

  const activeRecord = records.find((r: any) => r.status === "active")
  const failedRecord = records.find((r: any) => r.status === "failed")
  const latestRecord = records[0]

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            PPSR Lodgement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeRecord ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-700">Active</p>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Reg: {activeRecord.registrationNumber}
              </p>
              {activeRecord.lodgedAt && (
                <p className="text-xs text-green-600">
                  Lodged: {format(new Date(activeRecord.lodgedAt), "MMM d, yyyy")}
                </p>
              )}
              {activeRecord.expiresAt && (
                <p className="text-xs text-green-600">
                  Expires: {format(new Date(activeRecord.expiresAt), "MMM d, yyyy")}
                </p>
              )}
              <p className="text-xs text-green-600">
                Fee: ${(activeRecord.feeCents / 100).toFixed(2)}
              </p>
            </div>
          ) : failedRecord && !activeRecord ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm font-medium text-red-700">Failed</p>
              </div>
              <p className="text-xs text-red-600 mt-1">
                {failedRecord.errorMessage || "Unknown error"}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setShowConfirm(true)}
                disabled={!isApproved || lodging}
              >
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Button
                className="w-full"
                onClick={() => setShowConfirm(true)}
                disabled={!isApproved || lodging}
              >
                {lodging ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="mr-1.5 h-4 w-4" />
                )}
                {lodging ? "Lodging..." : "Lodge PPSR"}
              </Button>
              {!isApproved && (
                <p className="text-xs text-amber-600">
                  Approval required before PPSR lodgement
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lodge PPSR Registration</DialogTitle>
            <DialogDescription>
              This will lodge a PPSR registration and incur a fee.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <p><strong>VIN:</strong> {vehicle.vin}</p>
            <p><strong>Rego:</strong> {vehicle.registrationNumber}</p>
            <p><strong>Vehicle:</strong> {vehicle.year} {vehicle.make} {vehicle.model}</p>
            <p><strong>Seller:</strong> {vehicle.sellerName}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Estimated fee: ~$6.80 AUD
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleLodge} disabled={lodging}>
              {lodging && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirm & Lodge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
