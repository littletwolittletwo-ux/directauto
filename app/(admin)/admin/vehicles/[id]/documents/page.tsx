"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, FolderOpen } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentPreview } from "@/components/documents/DocumentPreview"
import { DocumentUploader } from "@/components/documents/DocumentUploader"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface VehicleDocument {
  id: string
  category: string
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
  uploadedById: string | null
}

interface VehicleData {
  id: string
  confirmationNumber: string
  make: string
  model: string
  year: number
  documents: VehicleDocument[]
}

const CATEGORY_LABELS: Record<string, string> = {
  licence_front: "Licence Front",
  licence_back: "Licence Back",
  selfie: "Selfie",
  ownership: "Ownership Document",
  ppsr_certificate: "PPSR Certificate",
  other: "Other",
}

export default function VehicleDocumentsPage() {
  const params = useParams()
  const vehicleId = params.id as string

  const [vehicle, setVehicle] = useState<VehicleData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchVehicle = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setVehicle(data)
    } catch {
      toast.error("Failed to load vehicle documents")
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchVehicle()
  }, [fetchVehicle])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Vehicle not found.</p>
      </div>
    )
  }

  // Group documents by category
  const grouped: Record<string, VehicleDocument[]> = {}
  for (const doc of vehicle.documents) {
    const cat = doc.category || "other"
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(doc)
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
          <h1 className="text-xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">
            {vehicle.confirmationNumber} - {vehicle.make} {vehicle.model} (
            {vehicle.year})
          </p>
        </div>
      </div>

      {/* Upload new documents */}
      <Card>
        <CardHeader>
          <CardTitle>Upload New Document</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploader
            vehicleId={vehicleId}
            category="other"
            onUpload={() => fetchVehicle()}
            multiple
          />
        </CardContent>
      </Card>

      {/* Document list by category */}
      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([category, docs]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                {CATEGORY_LABELS[category] || category}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({docs.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {docs.map((doc) => (
                  <div key={doc.id} className="space-y-1">
                    <DocumentPreview
                      documentId={doc.id}
                      originalName={doc.originalName}
                      mimeType={doc.mimeType}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No documents uploaded yet.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
