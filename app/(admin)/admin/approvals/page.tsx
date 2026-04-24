"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { format } from "date-fns"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Car,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { toast } from "sonner"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Vehicle {
  id: string
  confirmationNumber: string
  vin: string
  registrationNumber: string
  make: string
  model: string
  year: number
  odometer: number
  sellerPrice: number | null
  purchasePrice: number | null
  sellerName: string
  submittedAt: string
  approvalStatus: string
  approvalComment: string | null
  createdBy: { id: string; name: string; email: string } | null
}

interface QueueResponse {
  vehicles: Vehicle[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function ApprovalsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("PENDING")
  const [data, setData] = useState<QueueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Approval / rejection state
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [approveComment, setApproveComment] = useState("")
  const [rejectComment, setRejectComment] = useState("")
  const [processing, setProcessing] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const userRole = (session?.user as any)?.role

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/vehicles/approval-queue?status=${activeTab}&page=${page}&limit=20`
      )
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setData(json)
    } catch {
      toast.error("Failed to load approval queue")
    } finally {
      setLoading(false)
    }
  }, [activeTab, page])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  useEffect(() => {
    setPage(1)
  }, [activeTab])

  async function handleApprove() {
    if (!selectedVehicle) return
    setProcessing(true)
    try {
      const res = await fetch(
        `/api/vehicles/${selectedVehicle.id}/approval/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: approveComment.trim() || undefined }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Approval failed")
      }
      toast.success(
        `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} approved`
      )
      setShowApproveDialog(false)
      setApproveComment("")
      setSelectedVehicle(null)
      fetchQueue()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject() {
    if (!selectedVehicle) return
    setProcessing(true)
    try {
      const res = await fetch(
        `/api/vehicles/${selectedVehicle.id}/approval/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: rejectComment.trim() || undefined }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Rejection failed")
      }
      toast.success(
        `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} rejected`
      )
      setShowRejectDialog(false)
      setRejectComment("")
      setSelectedVehicle(null)
      fetchQueue()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  if (userRole !== "ACCOUNTS" && userRole !== "ADMIN") {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="mt-1 text-muted-foreground">
          Only Accounts and Admin users can access the approval queue.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchase Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve vehicle purchase applications
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="PENDING" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="APPROVED" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="REJECTED" className="gap-1.5">
            <XCircle className="h-4 w-4" />
            Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.vehicles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Car className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">
                  No {activeTab.toLowerCase()} applications
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                      <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                        Confirmation
                      </th>
                      <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">
                        Submitted By
                      </th>
                      <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                        Date
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Purchase Price
                      </th>
                      {activeTab === "PENDING" && (
                        <th className="px-4 py-3 text-right font-medium">
                          Actions
                        </th>
                      )}
                      {activeTab === "REJECTED" && (
                        <th className="px-4 py-3 text-left font-medium">
                          Reason
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.vehicles.map((v) => (
                      <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/vehicles/${v.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {v.year} {v.make} {v.model}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            VIN: {v.vin}
                          </p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {v.confirmationNumber}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                          {v.createdBy?.name || "—"}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                          {format(new Date(v.submittedAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {v.purchasePrice
                            ? `$${Number(v.purchasePrice).toLocaleString()}`
                            : "—"}
                        </td>
                        {activeTab === "PENDING" && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setSelectedVehicle(v)
                                  setShowApproveDialog(true)
                                }}
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedVehicle(v)
                                  setShowRejectDialog(true)
                                }}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          </td>
                        )}
                        {activeTab === "REJECTED" && (
                          <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                            {v.approvalComment || "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1}–
                    {Math.min(page * 20, data.pagination.total)} of{" "}
                    {data.pagination.total}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= data.pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Purchase</DialogTitle>
            <DialogDescription>
              Approve the purchase of{" "}
              {selectedVehicle &&
                `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
              {selectedVehicle?.purchasePrice &&
                ` for $${Number(selectedVehicle.purchasePrice).toLocaleString()}`}
              ?
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional comment..."
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            className="min-h-[60px]"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Purchase</DialogTitle>
            <DialogDescription>
              Reject the purchase of{" "}
              {selectedVehicle &&
                `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
              ? Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 h-4 w-4" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
