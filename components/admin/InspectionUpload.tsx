"use client"

import { useState, useCallback, useEffect } from "react"
import { format } from "date-fns"
import { FileText, Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentUploader } from "@/components/documents/DocumentUploader"
import { toast } from "sonner"

interface InspectionDoc {
  id: string
  originalName: string
  mimeType: string
  uploadedAt: string
}

interface InspectionUploadProps {
  vehicleId: string
}

export function InspectionUpload({ vehicleId }: InspectionUploadProps) {
  const [docs, setDocs] = useState<InspectionDoc[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`)
      if (res.ok) {
        const vehicle = await res.json()
        const inspectionDocs = (vehicle.documents || []).filter(
          (d: InspectionDoc & { category: string }) => d.category === "inspection"
        )
        setDocs(inspectionDocs)
      }
    } catch {
      console.error("Failed to fetch inspection docs")
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  function handleUpload() {
    toast.success("Inspection document uploaded")
    fetchDocs()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Upload Inspection Report</h3>
        <p className="text-xs text-muted-foreground">
          Upload inspection checklist, condition report, or any internal
          assessment documents
        </p>
      </div>

      <DocumentUploader
        vehicleId={vehicleId}
        category="inspection"
        onUpload={handleUpload}
        multiple
      />

      {/* Existing inspection docs */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : docs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Uploaded Inspection Documents ({docs.length})
          </p>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2"
            >
              {doc.mimeType.startsWith("image/") ? (
                <img
                  src={`/api/documents/${doc.id}`}
                  alt={doc.originalName}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-red-50">
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="truncate text-sm">{doc.originalName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(doc.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    window.open(`/api/documents/${doc.id}`, "_blank")
                  }
                  title="Preview"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <a
                  href={`/api/documents/${doc.id}?download=true`}
                  download
                  title="Download"
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
