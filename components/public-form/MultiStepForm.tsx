"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Check,
  Lock,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Step1Vehicle from "./Step1Vehicle";
import Step2SellerDetails from "./Step2SellerDetails";
import Step3Identity from "./Step3Identity";
import Step4Ownership from "./Step4Ownership";
import Step5Declaration from "./Step5Declaration";
import SuccessScreen from "./SuccessScreen";

const STORAGE_KEY = "lmct-submission-draft";

const STEPS = [
  { number: 1, label: "Your Vehicle" },
  { number: 2, label: "Your Details" },
  { number: 3, label: "Identity" },
  { number: 4, label: "Ownership" },
  { number: 5, label: "Declaration" },
];

interface FormState {
  // Step 1
  vin: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: string;
  odometer: string;
  // Step 2
  sellerName: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerAddress: string;
  // Step 3
  licenceNumber: string;
  licenceState: string;
  licenceExpiry: string;
  licenceFront: File | null;
  licenceBack: File | null;
  selfie: File | null;
  // Step 4
  ownershipType: string;
  ownershipFiles: File[];
  ownershipNotes: string;
  // Step 5
  declarationAgreed: boolean;
  consentAgreed: boolean;
  signatureName: string;
  // Hidden
  honeypot: string;
}

const defaultFormState: FormState = {
  vin: "",
  registrationNumber: "",
  make: "",
  model: "",
  year: "",
  odometer: "",
  sellerName: "",
  sellerPhone: "",
  sellerEmail: "",
  sellerAddress: "",
  licenceNumber: "",
  licenceState: "",
  licenceExpiry: "",
  licenceFront: null,
  licenceBack: null,
  selfie: null,
  ownershipType: "",
  ownershipFiles: [],
  ownershipNotes: "",
  declarationAgreed: false,
  consentAgreed: false,
  signatureName: "",
  honeypot: "",
};

// Fields that are serializable (no File objects)
const SERIALIZABLE_FIELDS = [
  "vin",
  "registrationNumber",
  "make",
  "model",
  "year",
  "odometer",
  "sellerName",
  "sellerPhone",
  "sellerEmail",
  "sellerAddress",
  "licenceNumber",
  "licenceState",
  "licenceExpiry",
  "ownershipType",
  "ownershipNotes",
  "declarationAgreed",
  "consentAgreed",
  "signatureName",
  "honeypot",
] as const;

interface PrefillData {
  make?: string;
  model?: string;
  year?: string;
  odometer?: string;
  registrationNumber?: string;
}

interface MultiStepFormProps {
  prefillVin?: string;
  prefillData?: PrefillData;
  tokenId?: string;
}

export default function MultiStepForm({
  prefillVin,
  prefillData,
  tokenId,
}: MultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormState>(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Check if vehicle details are pre-filled from token
  const hasVehiclePrefill = !!(prefillVin && prefillData?.make);

  // Clear old form data on mount so stale drafts don't cause issues
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }

    // Apply prefill if provided
    if (prefillVin || prefillData) {
      setFormData((prev) => ({
        ...prev,
        ...(prefillVin ? { vin: prefillVin } : {}),
        ...(prefillData?.make ? { make: prefillData.make } : {}),
        ...(prefillData?.model ? { model: prefillData.model } : {}),
        ...(prefillData?.year ? { year: prefillData.year } : {}),
        ...(prefillData?.odometer ? { odometer: prefillData.odometer } : {}),
        ...(prefillData?.registrationNumber ? { registrationNumber: prefillData.registrationNumber } : {}),
      }));
    }

    setMounted(true);
  }, [prefillVin, prefillData]);

  // Persist serializable fields to localStorage on every change
  useEffect(() => {
    if (!mounted) return;
    try {
      const serializable: Record<string, unknown> = {};
      for (const key of SERIALIZABLE_FIELDS) {
        serializable[key] = formData[key];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Ignore quota errors
    }
  }, [formData, mounted]);

  const handleChange = useCallback(
    (field: string, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleFileChange = useCallback(
    (field: string, file: File | null) => {
      setFormData((prev) => ({ ...prev, [field]: file }));
    },
    []
  );

  const handleOwnershipFilesChange = useCallback((files: File[]) => {
    setFormData((prev) => ({ ...prev, ownershipFiles: files }));
  }, []);

  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return !!(
          formData.vin.trim() &&
          formData.make.trim() &&
          formData.model.trim() &&
          formData.year.trim() &&
          formData.odometer.trim()
        );
      case 2:
        return !!(
          formData.sellerName.trim() &&
          formData.sellerPhone.trim() &&
          formData.sellerEmail.trim() &&
          formData.sellerAddress.trim()
        );
      case 3:
        return !!(
          formData.licenceNumber.trim() &&
          formData.licenceState &&
          formData.licenceExpiry
        );
      case 4:
        return !!(
          formData.ownershipType &&
          formData.ownershipFiles.length > 0
        );
      case 5:
        return !!(
          formData.declarationAgreed &&
          formData.consentAgreed &&
          formData.signatureName.trim()
        );
      default:
        return false;
    }
  }

  async function handleSubmit() {
    if (!canProceed()) return;

    // Honeypot check
    if (formData.honeypot) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const fd = new FormData();

      // Append all text fields
      fd.append("vin", formData.vin);
      fd.append("registrationNumber", formData.registrationNumber);
      fd.append("make", formData.make);
      fd.append("model", formData.model);
      fd.append("year", formData.year);
      fd.append("odometer", formData.odometer);
      fd.append("sellerName", formData.sellerName);
      fd.append("sellerPhone", formData.sellerPhone);
      fd.append("sellerEmail", formData.sellerEmail);
      fd.append("sellerAddress", formData.sellerAddress);
      fd.append("licenceNumber", formData.licenceNumber);
      fd.append("licenceState", formData.licenceState);
      fd.append("licenceExpiry", formData.licenceExpiry);
      fd.append("ownershipType", formData.ownershipType);
      fd.append("ownershipNotes", formData.ownershipNotes);
      fd.append("declarationAgreed", String(formData.declarationAgreed));
      fd.append("consentAgreed", String(formData.consentAgreed));
      fd.append("signatureName", formData.signatureName);

      if (tokenId) {
        fd.append("tokenId", tokenId);
      }

      // Append file fields
      if (formData.licenceFront) {
        fd.append("licenceFront", formData.licenceFront);
      }
      if (formData.licenceBack) {
        fd.append("licenceBack", formData.licenceBack);
      }
      if (formData.selfie) {
        fd.append("selfie", formData.selfie);
      }
      for (const file of formData.ownershipFiles) {
        fd.append("ownershipFiles", file);
      }

      const response = await fetch("/api/submit", {
        method: "POST",
        body: fd,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `Submission failed (${response.status})`
        );
      }

      const result = await response.json();

      setConfirmationNumber(result.confirmationNumber || result.id || "N/A");
      setVehicleId(result.vehicleId || result.id || "");
      setSubmitted(true);

      // Clear saved draft on success
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <SuccessScreen
                confirmationNumber={confirmationNumber}
                vehicleId={vehicleId}
                formData={formData}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="Direct Auto Wholesale" width={200} height={71} className="object-contain max-w-[200px]" />
        </div>

        {/* Stepper Header */}
        <nav aria-label="Form progress" className="mb-8">
          <ol className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isCompleted = currentStep > step.number;
              const isCurrent = currentStep === step.number;
              return (
                <li
                  key={step.number}
                  className="flex flex-col items-center relative flex-1"
                >
                  {/* Connector line */}
                  {index > 0 && (
                    <div
                      className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                        currentStep > step.number
                          ? "bg-green-500"
                          : currentStep === step.number
                          ? "bg-blue-200"
                          : "bg-gray-200"
                      }`}
                      style={{ zIndex: 0 }}
                    />
                  )}

                  {/* Step circle */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isCurrent
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      step.number
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`mt-2 text-xs text-center leading-tight hidden sm:block ${
                      isCompleted
                        ? "text-green-600 font-medium"
                        : isCurrent
                        ? "text-blue-600 font-medium"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                  {/* Mobile: show label only for current */}
                  {isCurrent && (
                    <span className="mt-2 text-xs text-blue-600 font-medium text-center leading-tight sm:hidden">
                      {step.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Form Card */}
        <Card>
          <CardContent className="p-6 sm:p-8">
            {/* Step Title */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Step {currentStep}: {STEPS[currentStep - 1].label}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {currentStep === 1 && (hasVehiclePrefill
                  ? "Vehicle details have been pre-filled. Please verify and continue."
                  : "Enter details about the vehicle you are selling.")}
                {currentStep === 2 && "Provide your contact and personal details."}
                {currentStep === 3 && "Upload your identity documents for verification."}
                {currentStep === 4 && "Provide proof of vehicle ownership."}
                {currentStep === 5 && "Review and sign the seller declaration."}
              </p>
            </div>

            {/* Step Content */}
            {currentStep === 1 && (
              <Step1Vehicle
                formData={formData}
                onChange={handleChange}
                vinLocked={!!prefillVin}
                fieldsLocked={hasVehiclePrefill}
              />
            )}
            {currentStep === 2 && (
              <Step2SellerDetails formData={formData} onChange={handleChange} />
            )}
            {currentStep === 3 && (
              <Step3Identity
                formData={formData}
                onChange={handleChange}
                onFileChange={handleFileChange}
              />
            )}
            {currentStep === 4 && (
              <Step4Ownership
                formData={formData}
                onChange={handleChange}
                onFilesChange={handleOwnershipFilesChange}
              />
            )}
            {currentStep === 5 && (
              <Step5Declaration formData={formData} onChange={handleChange} />
            )}

            {/* Honeypot - hidden field */}
            <div className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="hp_field">Leave this empty</label>
              <input
                id="hp_field"
                name="hp_field"
                type="text"
                value={formData.honeypot}
                onChange={(e) => handleChange("honeypot", e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                disabled={currentStep === 1}
                className="min-h-[44px] px-5 gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>

              {currentStep < 5 ? (
                <Button
                  onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
                  disabled={!canProceed()}
                  className="min-h-[44px] px-5 gap-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                  className="min-h-[44px] px-6 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trust Badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>Your information is secure</span>
        </div>
      </div>
    </div>
  );
}
