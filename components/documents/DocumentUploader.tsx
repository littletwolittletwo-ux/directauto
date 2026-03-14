"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  Camera,
  FolderOpen,
  X,
  FileText,
  ImageIcon,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ExistingDoc {
  id: string
  originalName: string
  mimeType: string
}

interface UploadedDoc {
  id: string
  previewUrl: string
}

interface DocumentUploaderProps {
  vehicleId: string
  category: string
  onUpload: (doc: UploadedDoc) => void
  multiple?: boolean
  existingDocs?: ExistingDoc[]
}

interface FileUploadState {
  file: File
  progress: number
  status: "uploading" | "done" | "error"
  docId?: string
  previewUrl?: string
  errorMessage?: string
}

export function DocumentUploader({
  vehicleId,
  category,
  onUpload,
  multiple = false,
  existingDocs = [],
}: DocumentUploaderProps) {
  const [uploads, setUploads] = useState<FileUploadState[]>([])

  const uploadFile = useCallback(
    async (file: File, index: number) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("vehicleId", vehicleId)
      formData.append("category", category)

      try {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setUploads((prev) =>
              prev.map((u, i) => (i === index ? { ...u, progress: pct } : u))
            )
          }
        })

        const result = await new Promise<{ documentId: string; previewUrl: string }>(
          (resolve, reject) => {
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText))
              } else {
                try {
                  const err = JSON.parse(xhr.responseText)
                  reject(new Error(err.error || "Upload failed"))
                } catch {
                  reject(new Error("Upload failed"))
                }
              }
            }
            xhr.onerror = () => reject(new Error("Network error"))
            xhr.open("POST", "/api/documents/upload")
            xhr.send(formData)
          }
        )

        setUploads((prev) =>
          prev.map((u, i) =>
            i === index
              ? {
                  ...u,
                  progress: 100,
                  status: "done",
                  docId: result.documentId,
                  previewUrl: result.previewUrl,
                }
              : u
          )
        )

        onUpload({ id: result.documentId, previewUrl: result.previewUrl })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed"
        setUploads((prev) =>
          prev.map((u, i) =>
            i === index
              ? { ...u, status: "error", errorMessage: message }
              : u
          )
        )
        toast.error(message)
      }
    },
    [vehicleId, category, onUpload]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const startIndex = uploads.length
      const newUploads: FileUploadState[] = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: "uploading" as const,
      }))

      setUploads((prev) => [...prev, ...newUploads])

      acceptedFiles.forEach((file, idx) => {
        uploadFile(file, startIndex + idx)
      })
    },
    [uploads.length, uploadFile]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "application/pdf": [".pdf"],
    },
    maxSize: 40 * 1024 * 1024, // 40MB
  })

  function removeUpload(index: number) {
    setUploads((prev) => prev.filter((_, i) => i !== index))
  }

  function handleMobileCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    onDrop(Array.from(files))
    e.target.value = ""
  }

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload
          className={cn(
            "mb-2 h-8 w-8",
            isDragActive ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop files here" : "Drag & drop files here"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          or click to browse. JPEG, PNG, WebP, PDF up to 40MB
        </p>
      </div>

      {/* Mobile buttons */}
      <div className="flex gap-2 sm:hidden">
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex-1 cursor-pointer"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          Take Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleMobileCapture}
          />
        </label>
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex-1 cursor-pointer"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
          Choose File
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleMobileCapture}
            multiple={multiple}
          />
        </label>
      </div>

      {/* Existing documents */}
      {existingDocs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Existing documents
          </p>
          <div className="flex flex-wrap gap-2">
            {existingDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
              >
                {doc.mimeType.startsWith("image/") ? (
                  <img
                    src={`/api/documents/${doc.id}`}
                    alt={doc.originalName}
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-red-500" />
                )}
                <span className="max-w-[120px] truncate text-xs">
                  {doc.originalName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-md border bg-white p-2"
            >
              {/* Thumbnail / icon */}
              {upload.status === "done" && upload.file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(upload.file)}
                  alt={upload.file.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : upload.file.type === "application/pdf" ? (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-red-50">
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-50">
                  <ImageIcon className="h-5 w-5 text-blue-500" />
                </div>
              )}

              {/* File info + progress */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm">{upload.file.name}</p>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="mt-1" />
                )}
                {upload.status === "error" && (
                  <p className="mt-0.5 text-xs text-red-500">
                    {upload.errorMessage}
                  </p>
                )}
                {upload.status === "done" && (
                  <p className="mt-0.5 text-xs text-green-600">Uploaded</p>
                )}
              </div>

              {/* Remove button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeUpload(idx)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
