"use client";

import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessScreenProps {
  confirmationNumber: string;
  vehicleId: string;
  formData: {
    vin: string;
    registrationNumber: string;
    make: string;
    model: string;
    year: string;
    odometer: string;
    sellerName: string;
    sellerPhone: string;
    sellerEmail: string;
    sellerAddress: string;
    licenceNumber: string;
    licenceState: string;
    ownershipType: string;
    signatureName: string;
  };
}

const OWNERSHIP_LABELS: Record<string, string> = {
  registration_certificate: "Registration certificate",
  purchase_receipt: "Previous purchase receipt",
  finance_payout: "Finance payout letter",
  other: "Other document",
};

export default function SuccessScreen({
  confirmationNumber,
  vehicleId,
  formData,
}: SuccessScreenProps) {
  const summaryRows = [
    { label: "VIN", value: formData.vin },
    { label: "Registration", value: formData.registrationNumber },
    { label: "Vehicle", value: `${formData.year} ${formData.make} ${formData.model}`.trim() },
    { label: "Odometer", value: formData.odometer ? `${Number(formData.odometer).toLocaleString()} km` : "" },
    { label: "Seller Name", value: formData.sellerName },
    { label: "Phone", value: formData.sellerPhone },
    { label: "Email", value: formData.sellerEmail },
    { label: "Address", value: formData.sellerAddress },
    { label: "Licence Number", value: formData.licenceNumber },
    { label: "Licence State", value: formData.licenceState },
    { label: "Ownership Type", value: OWNERSHIP_LABELS[formData.ownershipType] || formData.ownershipType },
    { label: "Signed By", value: formData.signatureName },
  ].filter((row) => row.value);

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Submission Received!</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Thank you for your submission. We&apos;ll review your documents and be in
          touch within 24 hours.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 px-6 py-4">
        <p className="text-xs text-muted-foreground mb-1">Confirmation Number</p>
        <p className="text-xl font-bold font-mono tracking-wide text-foreground">
          {confirmationNumber}
        </p>
      </div>

      <div className="w-full max-w-md">
        <h3 className="text-sm font-semibold text-foreground mb-3 text-left">
          Submission Summary
        </h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {summaryRows.map((row, idx) => (
                <tr
                  key={row.label}
                  className={idx % 2 === 0 ? "bg-muted/20" : "bg-transparent"}
                >
                  <td className="px-4 py-2.5 text-muted-foreground font-medium text-left whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="px-4 py-2.5 text-foreground text-right break-words">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button
        size="lg"
        variant="outline"
        className="min-h-[44px] px-6"
        onClick={() => {
          window.open(`/api/export/pdf/${vehicleId}?type=seller`, "_blank");
        }}
      >
        Download My Submission Summary PDF
      </Button>
    </div>
  );
}
