"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Upload, Camera, X } from "lucide-react";
import { useRef, useState, useCallback } from "react";

const AU_STATES = [
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "QLD", label: "Queensland" },
  { value: "SA", label: "South Australia" },
  { value: "WA", label: "Western Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "NT", label: "Northern Territory" },
  { value: "ACT", label: "Australian Capital Territory" },
];

interface Step3Props {
  formData: {
    licenceNumber: string;
    licenceState: string;
    licenceExpiry: string;
    licenceFront: File | null;
    licenceBack: File | null;
    selfie: File | null;
  };
  onChange: (field: string, value: string) => void;
  onFileChange: (field: string, file: File | null) => void;
}

function FileUploadZone({
  label,
  description,
  file,
  onSelect,
  onRemove,
  fieldId,
}: {
  label: string;
  description: string;
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  fieldId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    (f: File) => {
      onSelect(f);
      if (f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(f);
      }
    },
    [onSelect]
  );

  const handleRemove = useCallback(() => {
    onRemove();
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onRemove]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Generate preview from existing file on mount-like behavior
  if (file && !preview) {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  if (file && preview) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="relative rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            <img
              src={preview}
              alt={label}
              className="h-16 w-16 rounded-md object-cover border border-border"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors min-h-[44px] min-w-[44px]"
              aria-label={`Remove ${label}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors min-h-[120px] ${
          isDragOver
            ? "border-blue-400 bg-blue-50/50"
            : "border-border hover:border-blue-300 hover:bg-muted/30"
        }`}
      >
        <div className="flex items-center gap-3 text-muted-foreground">
          <Upload className="h-6 w-6" />
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">{description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tap to browse photos
        </p>
        {/* Main file input — no capture so iOS shows camera + library picker */}
        <input
          ref={inputRef}
          id={fieldId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      {/* Separate camera button for direct camera access on mobile */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          cameraInputRef.current?.click();
        }}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors min-h-[44px] sm:hidden"
      >
        <Camera className="h-4 w-4" />
        Take Photo
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

export default function Step3Identity({
  formData,
  onChange,
  onFileChange,
}: Step3Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="licenceNumber" className="text-sm font-medium">
          Drivers Licence Number <span className="text-red-500">*</span>
        </Label>
        <Input
          id="licenceNumber"
          value={formData.licenceNumber}
          onChange={(e) => onChange("licenceNumber", e.target.value)}
          placeholder="e.g. 12345678"
          className="py-3 h-auto text-base"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Issuing State <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.licenceState}
            onValueChange={(val: string | null) => onChange("licenceState", val ?? "")}
          >
            <SelectTrigger className="w-full py-3 h-auto text-base">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {AU_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.value} - {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="licenceExpiry" className="text-sm font-medium">
            Expiry Date <span className="text-red-500">*</span>
          </Label>
          <Input
            id="licenceExpiry"
            type="date"
            value={formData.licenceExpiry}
            onChange={(e) => onChange("licenceExpiry", e.target.value)}
            className="py-3 h-auto text-base"
          />
        </div>
      </div>

      <div className="border-t border-border pt-5 mt-5">
        <p className="text-sm text-muted-foreground mb-4">
          Please upload clear photos of your drivers licence and a selfie holding your licence for identity verification.
        </p>

        <div className="space-y-4">
          <FileUploadZone
            label="Licence Front"
            description="Upload front of your drivers licence"
            file={formData.licenceFront}
            onSelect={(f) => onFileChange("licenceFront", f)}
            onRemove={() => onFileChange("licenceFront", null)}
            fieldId="licenceFront"
          />

          <FileUploadZone
            label="Licence Back"
            description="Upload back of your drivers licence"
            file={formData.licenceBack}
            onSelect={(f) => onFileChange("licenceBack", f)}
            onRemove={() => onFileChange("licenceBack", null)}
            fieldId="licenceBack"
          />

          <FileUploadZone
            label="Selfie Holding Licence"
            description="Take a selfie holding your drivers licence"
            file={formData.selfie}
            onSelect={(f) => onFileChange("selfie", f)}
            onRemove={() => onFileChange("selfie", null)}
            fieldId="selfie"
          />
        </div>
      </div>
    </div>
  );
}
