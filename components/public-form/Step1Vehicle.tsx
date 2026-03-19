"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface Step1Props {
  formData: {
    vin: string;
    registrationNumber: string;
    make: string;
    model: string;
    year: string;
    odometer: string;
  };
  onChange: (field: string, value: string) => void;
  vinLocked?: boolean;
  fieldsLocked?: boolean;
}

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

export default function Step1Vehicle({ formData, onChange, vinLocked, fieldsLocked }: Step1Props) {
  const [vinError, setVinError] = useState<string | null>(null);

  function handleVinBlur() {
    const v = formData.vin.trim();
    if (v.length === 0) {
      setVinError(null);
      return;
    }
    if (v.length !== 17) {
      setVinError("VIN must be exactly 17 characters.");
      return;
    }
    if (!VIN_REGEX.test(v)) {
      setVinError("VIN contains invalid characters. Only letters (except I, O, Q) and numbers are allowed.");
      return;
    }
    setVinError(null);
  }

  const locked = fieldsLocked || false;

  return (
    <div className="space-y-5">
      {locked && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800 font-medium">
            Vehicle details have been pre-filled by the dealership. Please complete your personal details below.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="vin" className="text-sm font-medium">
          VIN (Vehicle Identification Number) <span className="text-red-500">*</span>
        </Label>
        <Input
          id="vin"
          value={formData.vin}
          onChange={(e) => onChange("vin", e.target.value.toUpperCase())}
          onBlur={handleVinBlur}
          placeholder="e.g. 1HGCM82633A004352"
          maxLength={17}
          disabled={vinLocked || locked}
          readOnly={vinLocked || locked}
          className="py-3 h-auto text-base"
          aria-invalid={vinError ? true : undefined}
        />
        {vinError && (
          <p className="text-sm text-red-500 mt-1">{vinError}</p>
        )}
        {(vinLocked || locked) && (
          <p className="text-xs text-muted-foreground">VIN has been pre-filled and cannot be changed.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="registrationNumber" className="text-sm font-medium">
          Registration Number
        </Label>
        <Input
          id="registrationNumber"
          value={formData.registrationNumber}
          onChange={(e) => onChange("registrationNumber", e.target.value.toUpperCase())}
          placeholder="e.g. ABC123"
          disabled={locked}
          readOnly={locked}
          className="py-3 h-auto text-base"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="make" className="text-sm font-medium">
            Make <span className="text-red-500">*</span>
          </Label>
          <Input
            id="make"
            value={formData.make}
            onChange={(e) => onChange("make", e.target.value)}
            placeholder="e.g. Toyota"
            disabled={locked}
            readOnly={locked}
            className="py-3 h-auto text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model" className="text-sm font-medium">
            Model <span className="text-red-500">*</span>
          </Label>
          <Input
            id="model"
            value={formData.model}
            onChange={(e) => onChange("model", e.target.value)}
            placeholder="e.g. Camry"
            disabled={locked}
            readOnly={locked}
            className="py-3 h-auto text-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="year" className="text-sm font-medium">
            Year <span className="text-red-500">*</span>
          </Label>
          <Input
            id="year"
            type="number"
            value={formData.year}
            onChange={(e) => onChange("year", e.target.value)}
            placeholder="e.g. 2020"
            min={1900}
            max={new Date().getFullYear() + 1}
            disabled={locked}
            readOnly={locked}
            className="py-3 h-auto text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="odometer" className="text-sm font-medium">
            Odometer <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="odometer"
              type="number"
              value={formData.odometer}
              onChange={(e) => onChange("odometer", e.target.value)}
              placeholder="e.g. 85000"
              min={0}
              disabled={locked}
              readOnly={locked}
              className="py-3 h-auto text-base pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
