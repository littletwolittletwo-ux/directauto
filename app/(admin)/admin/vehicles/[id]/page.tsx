"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft,
  Save,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  FileDown,
  FileText,
  Loader2,
  Shield,
  Send,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { RiskGauge } from "@/components/admin/RiskGauge"
import { AdminNotes } from "@/components/admin/AdminNotes"
import { AuditTimeline } from "@/components/admin/AuditTimeline"
import { DocumentPreview } from "@/components/documents/DocumentPreview"
import { DocumentUploader } from "@/components/documents/DocumentUploader"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { SaleAgreementPanel } from "@/components/admin/SaleAgreementPanel"

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
  location: string | null
  sellerName: string
  sellerPhone: string
  sellerEmail: string
  submissionSource: string
  submissionToken: string | null
  ipAddress: string | null
  status: string
  riskScore: number
  riskFlags: string[]
  adminNotes: any[]
  sellerSignature: string | null
  signedAt: string | null
  submittedAt: string
  identity: {
    id: string
    fullLegalName: string
    address: string
    driversLicenceNumber: string
    licenceState: string
    licenceExpiry: string
    licenceFrontDocId: string | null
    licenceBackDocId: string | null
    selfieDocId: string | null
    verifiedAt: string | null
    verifiedById: string | null
  } | null
  ownership: {
    id: string
    documentType: string
    notes: string | null
  } | null
  ppsrCheck: {
    id: string
    checkedAt: string
    isWrittenOff: boolean
    isStolen: boolean
    hasFinance: boolean
    certificateDocId: string | null
    status: string
  } | null
  documents: {
    id: string
    category: string
    originalName: string
    mimeType: string
    uploadedAt: string
  }[]
  auditLogs: {
    id: string
    action: string
    createdAt: string
    user: { id: string; name: string; email: string } | null
    details: any
  }[]
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

export default function VehicleDetailPage() {
  const params = useParams()
  const { data: session } = useSession()
  const vehicleId = params.id as string
  const isAdmin = session?.user?.role === "ADMIN"

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)

  // Inline edit state
  const [editPrice, setEditPrice] = useState("")
  const [editLocation, setEditLocation] = useState("")
  const [savingFields, setSavingFields] = useState(false)

  // PPSR form state
  const [ppsrDate, setPpsrDate] = useState("")
  const [ppsrWrittenOff, setPpsrWrittenOff] = useState(false)
  const [ppsrStolen, setPpsrStolen] = useState(false)
  const [ppsrFinance, setPpsrFinance] = useState(false)
  const [savingPPSR, setSavingPPSR] = useState(false)
  const [runningLivePPSR, setRunningLivePPSR] = useState(false)

  // Reject modal
  const [rejectReason, setRejectReason] = useState("")
  const [rejecting, setRejecting] = useState(false)

  // Request more info modal
  const [requestMessage, setRequestMessage] = useState("")
  const [requesting, setRequesting] = useState(false)

  // Link generation
  const [generatingLink, setGeneratingLink] = useState(false)


  const fetchVehicle = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`)
      if (!res.ok) throw new Error("Failed to fetch vehicle")
      const data = await res.json()
      setVehicle(data)
      setEditPrice(data.sellerPrice?.toString() || "")
      setEditLocation(data.location || "")

      // Initialize PPSR form from existing data
      if (data.ppsrCheck) {
        setPpsrDate(
          data.ppsrCheck.checkedAt
            ? new Date(data.ppsrCheck.checkedAt).toISOString().split("T")[0]
            : ""
        )
        setPpsrWrittenOff(data.ppsrCheck.isWrittenOff)
        setPpsrStolen(data.ppsrCheck.isStolen)
        setPpsrFinance(data.ppsrCheck.hasFinance)
      }
    } catch {
      toast.error("Failed to load vehicle")
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchVehicle()
  }, [fetchVehicle])

  async function handleSaveFields() {
    setSavingFields(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerPrice: editPrice ? editPrice : null,
          location: editLocation || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast.success("Vehicle details updated")
      fetchVehicle()
    } catch {
      toast.error("Failed to save changes")
    } finally {
      setSavingFields(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success("Status updated")
      fetchVehicle()
    } catch {
      toast.error("Failed to change status")
    }
  }

  async function handleApprove() {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/approve`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to approve")
      toast.success("Vehicle approved")
      fetchVehicle()
    } catch {
      toast.error("Failed to approve vehicle")
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Please enter a rejection reason")
      return
    }
    setRejecting(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      if (!res.ok) throw new Error("Failed to reject")
      toast.success("Vehicle rejected")
      setRejectReason("")
      fetchVehicle()
    } catch {
      toast.error("Failed to reject vehicle")
    } finally {
      setRejecting(false)
    }
  }

  async function handleRequestMoreInfo() {
    if (!requestMessage.trim()) {
      toast.error("Please enter a message")
      return
    }
    setRequesting(true)
    try {
      // For now, send as a note + open mailto
      const subject = `Additional information needed - ${vehicle?.confirmationNumber}`
      const body = requestMessage.trim()
      window.open(
        `mailto:${vehicle?.sellerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        "_blank"
      )
      toast.success("Email client opened")
      setRequestMessage("")
    } catch {
      toast.error("Failed to send request")
    } finally {
      setRequesting(false)
    }
  }

  async function handleSavePPSR() {
    setSavingPPSR(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/ppsr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkedAt: ppsrDate || new Date().toISOString(),
          isWrittenOff: ppsrWrittenOff,
          isStolen: ppsrStolen,
          hasFinance: ppsrFinance,
          status: "COMPLETED",
        }),
      })
      if (!res.ok) throw new Error("Failed to save PPSR results")
      toast.success("PPSR results saved")
      fetchVehicle()
    } catch {
      toast.error("Failed to save PPSR results")
    } finally {
      setSavingPPSR(false)
    }
  }

  async function handleRunLivePPSR() {
    setRunningLivePPSR(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/ppsr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "PPSR check failed")
      toast.success("Live PPSR check completed")
      fetchVehicle()
    } catch (err: any) {
      toast.error(err.message || "Failed to run live PPSR check")
    } finally {
      setRunningLivePPSR(false)
    }
  }

  async function handleGenerateLink() {
    setGeneratingLink(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/generate-link`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to generate link")
      const data = await res.json()
      await navigator.clipboard.writeText(data.url)
      toast.success("Seller link generated and copied to clipboard")
      fetchVehicle()
    } catch {
      toast.error("Failed to generate link")
    } finally {
      setGeneratingLink(false)
    }
  }

  function handleDownloadPDF() {
    window.open(`/api/export/pdf/${vehicleId}`, "_blank")
  }

  async function handleIdentityAction(verified: boolean) {
    try {
      await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: verified ? vehicle?.status : "DOCUMENTS_MISSING",
        }),
      })
      toast.success(verified ? "Identity verified" : "Identity issues flagged")
      fetchVehicle()
    } catch {
      toast.error("Failed to update identity status")
    }
  }

  async function handleOwnershipAction(confirmed: boolean) {
    try {
      await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: confirmed ? vehicle?.status : "DOCUMENTS_MISSING",
        }),
      })
      toast.success(
        confirmed ? "Ownership confirmed" : "Ownership issues flagged"
      )
      fetchVehicle()
    } catch {
      toast.error("Failed to update ownership status")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-semibold">Vehicle not found</h2>
        <p className="mt-1 text-muted-foreground">
          The vehicle you are looking for does not exist or has been deleted.
        </p>
        <Link
          href="/admin/vehicles"
          className={cn(buttonVariants(), "mt-4")}
        >
          Back to Vehicles
        </Link>
      </div>
    )
  }

  const source = SOURCE_BADGES[vehicle.submissionSource]
  const licenceFrontDoc = vehicle.documents.find(
    (d) => d.id === vehicle.identity?.licenceFrontDocId
  )
  const licenceBackDoc = vehicle.documents.find(
    (d) => d.id === vehicle.identity?.licenceBackDocId
  )
  const selfieDoc = vehicle.documents.find(
    (d) => d.id === vehicle.identity?.selfieDocId
  )
  const ownershipDocs = vehicle.documents.filter(
    (d) => d.category === "ownership"
  )
  const ppsrCertDoc = vehicle.ppsrCheck?.certificateDocId
    ? vehicle.documents.find((d) => d.id === vehicle.ppsrCheck?.certificateDocId)
    : null

  const adminNotes: { note: string; userId: string; userName: string; createdAt: string }[] =
    Array.isArray(vehicle.adminNotes)
      ? vehicle.adminNotes.map((n: any) => {
          if (typeof n === "string") {
            return {
              note: n,
              userId: "",
              userName: "System",
              createdAt: new Date().toISOString(),
            }
          }
          return n
        })
      : []

  const riskFlags: string[] = Array.isArray(vehicle.riskFlags)
    ? vehicle.riskFlags.map((f: any) => (typeof f === "string" ? f : String(f)))
    : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/vehicles"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Link>
        <div>
          <h1 className="text-xl font-semibold">
            {vehicle.make} {vehicle.model} ({vehicle.year})
          </h1>
          <p className="text-sm text-muted-foreground">
            {vehicle.confirmationNumber} | VIN: {vehicle.vin}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
        {/* Left column (70%) */}
        <div className="space-y-4">
          {/* Card 1: Vehicle Information */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">VIN</p>
                  <p className="font-mono text-sm">{vehicle.vin}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registration</p>
                  <p className="text-sm">{vehicle.registrationNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Make</p>
                  <p className="text-sm">{vehicle.make}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Model</p>
                  <p className="text-sm">{vehicle.model}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Year</p>
                  <p className="text-sm">{vehicle.year}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Odometer</p>
                  <p className="text-sm">
                    {vehicle.odometer.toLocaleString()} km
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Inline edit for Price/Location */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Seller Price ($)
                  </Label>
                  <Input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="Not set"
                    min={0}
                    step="0.01"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Location
                  </Label>
                  <Input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Not set"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveFields}
                  disabled={savingFields}
                >
                  {savingFields ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Seller Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Seller Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{vehicle.sellerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <a
                    href={`tel:${vehicle.sellerPhone}`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {vehicle.sellerPhone}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <a
                    href={`mailto:${vehicle.sellerEmail}`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {vehicle.sellerEmail}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Submission Date
                  </p>
                  <p className="text-sm">
                    {format(
                      new Date(vehicle.submittedAt),
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IP Address</p>
                  <p className="font-mono text-xs">
                    {vehicle.ipAddress || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  {source && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        source.className
                      )}
                    >
                      {source.label}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Identity Verification */}
          <Card>
            <CardHeader>
              <CardTitle>Identity Verification</CardTitle>
            </CardHeader>
            <CardContent>
              {vehicle.identity ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Full Legal Name
                      </p>
                      <p className="text-sm">{vehicle.identity.fullLegalName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="text-sm">{vehicle.identity.address}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Licence Number
                      </p>
                      <p className="font-mono text-sm">
                        {vehicle.identity.driversLicenceNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Licence State
                      </p>
                      <p className="text-sm">{vehicle.identity.licenceState}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Licence Expiry
                      </p>
                      <p className="text-sm">
                        {format(
                          new Date(vehicle.identity.licenceExpiry),
                          "MMM d, yyyy"
                        )}
                      </p>
                    </div>
                    {vehicle.identity.verifiedAt && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Verified At
                        </p>
                        <p className="text-sm text-green-600">
                          {format(
                            new Date(vehicle.identity.verifiedAt),
                            "MMM d, yyyy"
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ID Document previews */}
                  <div className="flex flex-wrap gap-3">
                    {licenceFrontDoc && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                          Licence Front
                        </p>
                        <DocumentPreview
                          documentId={licenceFrontDoc.id}
                          originalName={licenceFrontDoc.originalName}
                          mimeType={licenceFrontDoc.mimeType}
                        />
                      </div>
                    )}
                    {licenceBackDoc && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                          Licence Back
                        </p>
                        <DocumentPreview
                          documentId={licenceBackDoc.id}
                          originalName={licenceBackDoc.originalName}
                          mimeType={licenceBackDoc.mimeType}
                        />
                      </div>
                    )}
                    {selfieDoc && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                          Selfie
                        </p>
                        <DocumentPreview
                          documentId={selfieDoc.id}
                          originalName={selfieDoc.originalName}
                          mimeType={selfieDoc.mimeType}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleIdentityAction(true)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Mark Identity Verified
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleIdentityAction(false)}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Identity Issues Found
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No identity information submitted yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card 4: Ownership Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Ownership Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {vehicle.ownership ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Document Type
                    </p>
                    <p className="text-sm">{vehicle.ownership.documentType}</p>
                  </div>
                  {vehicle.ownership.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm">{vehicle.ownership.notes}</p>
                    </div>
                  )}
                  {ownershipDocs.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {ownershipDocs.map((doc) => (
                        <DocumentPreview
                          key={doc.id}
                          documentId={doc.id}
                          originalName={doc.originalName}
                          mimeType={doc.mimeType}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleOwnershipAction(true)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Ownership Confirmed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleOwnershipAction(false)}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Issues Found
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No ownership documents submitted yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card 5: PPSR Check */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                PPSR Check
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Live PPSR Check button */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleRunLivePPSR}
                    disabled={runningLivePPSR}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {runningLivePPSR ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="mr-1.5 h-4 w-4" />
                    )}
                    {runningLivePPSR ? "Searching PPSR..." : "Run PPSR Check"}
                  </Button>
                  {vehicle.ppsrCheck?.checkedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last checked:{" "}
                      {format(
                        new Date(vehicle.ppsrCheck.checkedAt),
                        "dd MMM yyyy 'at' h:mm a"
                      )}
                    </span>
                  )}
                </div>

                {/* PPSR Results */}
                {vehicle.ppsrCheck && vehicle.ppsrCheck.status === "COMPLETED" && (
                  <>
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-3 text-center",
                          vehicle.ppsrCheck.isWrittenOff
                            ? "border-red-300 bg-red-50"
                            : "border-green-300 bg-green-50"
                        )}
                      >
                        {vehicle.ppsrCheck.isWrittenOff ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        <span className="text-sm font-medium">Written Off</span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            vehicle.ppsrCheck.isWrittenOff
                              ? "text-red-700"
                              : "text-green-700"
                          )}
                        >
                          {vehicle.ppsrCheck.isWrittenOff ? "YES" : "NO"}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-3 text-center",
                          vehicle.ppsrCheck.isStolen
                            ? "border-red-300 bg-red-50"
                            : "border-green-300 bg-green-50"
                        )}
                      >
                        {vehicle.ppsrCheck.isStolen ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        <span className="text-sm font-medium">Stolen</span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            vehicle.ppsrCheck.isStolen
                              ? "text-red-700"
                              : "text-green-700"
                          )}
                        >
                          {vehicle.ppsrCheck.isStolen ? "YES" : "NO"}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-3 text-center",
                          vehicle.ppsrCheck.hasFinance
                            ? "border-red-300 bg-red-50"
                            : "border-green-300 bg-green-50"
                        )}
                      >
                        {vehicle.ppsrCheck.hasFinance ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        <span className="text-sm font-medium">Finance / Encumbrance</span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            vehicle.ppsrCheck.hasFinance
                              ? "text-red-700"
                              : "text-green-700"
                          )}
                        >
                          {vehicle.ppsrCheck.hasFinance ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Manual override section */}
                <Separator />
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Manual Override
                  </summary>
                  <div className="mt-3 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Check Date
                        </Label>
                        <Input
                          type="date"
                          value={ppsrDate}
                          onChange={(e) => setPpsrDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setPpsrWrittenOff(!ppsrWrittenOff)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors",
                          ppsrWrittenOff
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-gray-200 hover:bg-muted/50"
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            "h-5 w-5",
                            ppsrWrittenOff
                              ? "text-red-500"
                              : "text-muted-foreground"
                          )}
                        />
                        <span className="text-sm font-medium">Written Off</span>
                        <span className="text-xs">
                          {ppsrWrittenOff ? "YES" : "NO"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPpsrStolen(!ppsrStolen)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors",
                          ppsrStolen
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-gray-200 hover:bg-muted/50"
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            "h-5 w-5",
                            ppsrStolen
                              ? "text-red-500"
                              : "text-muted-foreground"
                          )}
                        />
                        <span className="text-sm font-medium">Stolen</span>
                        <span className="text-xs">
                          {ppsrStolen ? "YES" : "NO"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPpsrFinance(!ppsrFinance)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors",
                          ppsrFinance
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-gray-200 hover:bg-muted/50"
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            "h-5 w-5",
                            ppsrFinance
                              ? "text-red-500"
                              : "text-muted-foreground"
                          )}
                        />
                        <span className="text-sm font-medium">Finance</span>
                        <span className="text-xs">
                          {ppsrFinance ? "YES" : "NO"}
                        </span>
                      </button>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSavePPSR}
                        disabled={savingPPSR}
                      >
                        {savingPPSR ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Save Manual Results
                      </Button>
                    </div>
                  </div>
                </details>

                {/* PPSR Certificate upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    PPSR Certificate
                  </Label>
                  {ppsrCertDoc ? (
                    <DocumentPreview
                      documentId={ppsrCertDoc.id}
                      originalName={ppsrCertDoc.originalName}
                      mimeType={ppsrCertDoc.mimeType}
                    />
                  ) : (
                    <DocumentUploader
                      vehicleId={vehicleId}
                      category="ppsr_certificate"
                      onUpload={() => fetchVehicle()}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 6: Declaration */}
          <Card>
            <CardHeader>
              <CardTitle>Declaration</CardTitle>
            </CardHeader>
            <CardContent>
              {vehicle.sellerSignature ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
                    I, the undersigned, declare that all information provided in
                    this form is true and correct to the best of my knowledge.
                    I am the legal owner of the vehicle described and I am
                    authorized to sell this vehicle. I understand that providing
                    false information may result in legal consequences.
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Signature</p>
                    <p
                      className="mt-1 text-2xl"
                      style={{ fontFamily: "'Dancing Script', cursive, serif" }}
                    >
                      {vehicle.sellerSignature}
                    </p>
                  </div>
                  <div className="flex gap-6 text-xs text-muted-foreground">
                    {vehicle.signedAt && (
                      <span>
                        Signed:{" "}
                        {format(
                          new Date(vehicle.signedAt),
                          "MMM d, yyyy 'at' h:mm a"
                        )}
                      </span>
                    )}
                    {vehicle.ipAddress && (
                      <span>IP: {vehicle.ipAddress}</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Declaration not yet signed.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent audit logs inline */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Audit History</CardTitle>
                <Link
                  href={`/admin/vehicles/${vehicleId}/audit`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  View All
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <AuditTimeline logs={vehicle.auditLogs.slice(0, 5)} />
            </CardContent>
          </Card>
        </div>

        {/* Right column (30%) sticky */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Status card */}
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <StatusBadge status={vehicle.status} />
              </div>

              {isAdmin && (
                <Select
                  value={vehicle.status}
                  onValueChange={(val: string | null) => val && handleStatusChange(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING_VERIFICATION">
                      Pending Verification
                    </SelectItem>
                    <SelectItem value="DOCUMENTS_MISSING">
                      Documents Missing
                    </SelectItem>
                    <SelectItem value="RISK_FLAGGED">Risk Flagged</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Risk gauge */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <RiskGauge score={vehicle.riskScore} flags={riskFlags} />
            </CardContent>
          </Card>

          {/* Admin notes */}
          <Card>
            <CardContent className="pt-4">
              <AdminNotes
                vehicleId={vehicleId}
                notes={adminNotes}
                onNoteAdded={fetchVehicle}
              />
            </CardContent>
          </Card>

          {/* Action buttons */}
          {isAdmin && (
            <Card>
              <CardContent className="space-y-2 pt-4">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Approve
                </Button>

                {/* Reject with modal */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Reject
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Reject Vehicle</DialogTitle>
                      <DialogDescription>
                        Please provide a reason for rejection. This will be
                        logged in the audit trail.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Enter rejection reason..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        variant="destructive"
                        onClick={handleReject}
                        disabled={rejecting || !rejectReason.trim()}
                      >
                        {rejecting ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-1.5 h-4 w-4" />
                        )}
                        Reject Vehicle
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Request More Info modal */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Send className="mr-1.5 h-4 w-4" />
                      Request More Info
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Request More Information</DialogTitle>
                      <DialogDescription>
                        This will open your email client with a pre-filled
                        message to the seller.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        To: {vehicle.sellerEmail}
                      </Label>
                      <Textarea
                        placeholder="Enter your message to the seller..."
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        className="min-h-[100px]"
                        defaultValue={`Dear ${vehicle.sellerName},\n\nRegarding your vehicle submission (${vehicle.confirmationNumber}), we require additional information to proceed with the review.\n\nPlease provide the following:\n- \n\nThank you.`}
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        onClick={handleRequestMoreInfo}
                        disabled={requesting}
                      >
                        <Mail className="mr-1.5 h-4 w-4" />
                        Open Email
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGenerateLink}
                  disabled={generatingLink}
                >
                  {generatingLink ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-1.5 h-4 w-4" />
                  )}
                  Generate Seller Link
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadPDF}
                >
                  <FileDown className="mr-1.5 h-4 w-4" />
                  Download PDF Report
                </Button>

                {vehicle.status === "APPROVED" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(`/api/vehicles/${vehicleId}/bill-of-sale`, '_blank')}
                  >
                    <FileText className="mr-1.5 h-4 w-4" />
                    Generate Bill of Sale
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sale Agreement Panel — only for approved vehicles */}
          {vehicle.status === "APPROVED" && (
            <SaleAgreementPanel
              vehicleId={vehicleId}
              vehicleInfo={{
                sellerName: vehicle.sellerName,
                sellerEmail: vehicle.sellerEmail,
                sellerPrice: vehicle.sellerPrice,
                year: vehicle.year,
                make: vehicle.make,
                model: vehicle.model,
              }}
            />
          )}

          {/* Quick contact */}
          <Card>
            <CardContent className="flex gap-2 pt-4">
              <a
                href={`tel:${vehicle.sellerPhone}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "flex-1"
                )}
              >
                <Phone className="mr-1.5 h-3.5 w-3.5" />
                Call Seller
              </a>
              <a
                href={`mailto:${vehicle.sellerEmail}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "flex-1"
                )}
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Email Seller
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
