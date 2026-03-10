"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Camera, X } from "lucide-react";
import { useRef, useState, useCallback } from "react";

const OWNERSHIP_OPTIONS = [
  { value: "registration_certificate", label: "Registration certificate" },
  { value: "purchase_receipt", label: "Previous purchase receipt" },
  { value: "finance_payout", label: "Finance payout letter" },
  { value: "other", label: "Other document" },
];

interface Step4Props {
  formData: {
    ownershipType: string;
    ownershipFiles: File[];
    ownershipNotes: string;
  };
  onChange: (field: string, value: string) => void;
  onFilesChange: (files: File[]) => void;
}

function FilePreview({
  file,
  index,
  onRemove,
}: {
  file: File;
  index: number;
  onRemove: (index: number) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  if (file.type.startsWith("image/") && !preview) {
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
      {preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-12 w-12 rounded-md object-cover border border-border"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground">
          FILE
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(file.size / 1024).toFixed(0)} KB
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="flex items-center justify-center h-8 w-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors min-h-[44px] min-w-[44px]"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Step4Ownership({
  formData,
  onChange,
  onFilesChange,
}: Step4Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleAddFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const combined = [...formData.ownershipFiles, ...fileArray];
      onFilesChange(combined);
    },
    [formData.ownershipFiles, onFilesChange]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const updated = formData.ownershipFiles.filter((_, i) => i !== index);
      onFilesChange(updated);
    },
    [formData.ownershipFiles, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleAddFiles(e.dataTransfer.files);
      }
    },
    [handleAddFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Ownership Document Type <span className="text-red-500">*</span>
        </Label>
        <RadioGroup
          value={formData.ownershipType}
          onValueChange={(val: string) => onChange("ownershipType", val)}
          className="space-y-2"
        >
          {OWNERSHIP_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/30 transition-colors min-h-[44px]"
            >
              <RadioGroupItem value={option.value} />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="border-t border-border pt-5 mt-5 space-y-3">
        <Label className="text-sm font-medium">
          Upload Ownership Documents <span className="text-red-500">*</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Upload one or more files to prove ownership. You can add photos or scanned documents.
        </p>

        {formData.ownershipFiles.length > 0 && (
          <div className="space-y-2">
            {formData.ownershipFiles.map((file, index) => (
              <FilePreview
                key={`${file.name}-${index}`}
                file={file}
                index={index}
                onRemove={handleRemoveFile}
              />
            ))}
          </div>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors min-h-[120px] ${
            isDragOver
              ? "border-blue-400 bg-blue-50/50"
              : "border-border hover:border-blue-300 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center gap-3 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <Camera className="h-6 w-6" />
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">
            {formData.ownershipFiles.length > 0
              ? "Add more files"
              : "Upload ownership documents"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap to browse or use camera
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleAddFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownershipNotes" className="text-sm font-medium">
          Additional Notes (Optional)
        </Label>
        <Textarea
          id="ownershipNotes"
          value={formData.ownershipNotes}
          onChange={(e) => onChange("ownershipNotes", e.target.value)}
          placeholder="Any additional information about ownership..."
          rows={3}
          className="py-3 text-base min-h-[80px]"
        />
      </div>
    </div>
  );
}
