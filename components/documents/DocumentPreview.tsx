"use client"

import { useState, useCallback, useEffect } from "react"
import { FileText, X, ZoomIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DocumentPreviewProps {
  documentId: string
  originalName: string
  mimeType: string
}

export function DocumentPreview({
  documentId,
  originalName,
  mimeType,
}: DocumentPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const isImage = mimeType.startsWith("image/")
  const isPDF = mimeType === "application/pdf"
  const previewUrl = `/api/documents/${documentId}`

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && lightboxOpen) {
        setLightboxOpen(false)
      }
    },
    [lightboxOpen]
  )

  useEffect(() => {
    if (lightboxOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [lightboxOpen, handleKeyDown])

  if (isImage) {
    return (
      <>
        {/* Thumbnail */}
        <button
          onClick={() => setLightboxOpen(true)}
          className="group relative overflow-hidden rounded-lg border bg-muted/30 transition-all hover:ring-2 hover:ring-primary/50"
        >
          <img
            src={previewUrl}
            alt={originalName}
            className="h-24 w-24 object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <ZoomIn className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
            {originalName}
          </span>
        </button>

        {/* Lightbox */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setLightboxOpen(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation()
                setLightboxOpen(false)
              }}
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={previewUrl}
              alt={originalName}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    )
  }

  if (isPDF) {
    return (
      <button
        onClick={() => window.open(previewUrl, "_blank")}
        className={cn(
          "group flex flex-col items-center justify-center gap-1 rounded-lg border bg-muted/30 p-3 transition-all hover:ring-2 hover:ring-primary/50",
          "h-24 w-24"
        )}
      >
        <FileText className="h-8 w-8 text-red-500" />
        <span className="max-w-full truncate text-[10px] text-muted-foreground group-hover:text-foreground">
          {originalName}
        </span>
      </button>
    )
  }

  // Fallback for other file types
  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center justify-center gap-1 rounded-lg border bg-muted/30 p-3 transition-all hover:ring-2 hover:ring-primary/50 h-24 w-24"
    >
      <FileText className="h-8 w-8 text-muted-foreground" />
      <span className="max-w-full truncate text-[10px] text-muted-foreground">
        {originalName}
      </span>
    </a>
  )
}
