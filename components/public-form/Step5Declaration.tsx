"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface Step5Props {
  formData: {
    sellerName: string;
    declarationAgreed: boolean;
    consentAgreed: boolean;
    signatureName: string;
  };
  onChange: (field: string, value: string | boolean) => void;
}

export default function Step5Declaration({ formData, onChange }: Step5Props) {
  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/20 p-5">
        <h3 className="text-base font-semibold mb-3">Seller Declaration</h3>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            I, <span className="font-semibold text-foreground">{formData.sellerName || "[Your Name]"}</span>,
            hereby declare and confirm the following:
          </p>
          <ol className="list-decimal list-inside space-y-2 pl-1">
            <li>
              I am the legal owner of the vehicle described in this submission, or I am
              duly authorised to act on behalf of the legal owner for the purpose of this sale.
            </li>
            <li>
              The vehicle is free from any encumbrances, liens, or financial obligations
              unless otherwise disclosed in this submission.
            </li>
            <li>
              All information provided in this submission is true, correct, and complete
              to the best of my knowledge.
            </li>
            <li>
              The odometer reading provided accurately reflects the current mileage of the
              vehicle to the best of my knowledge.
            </li>
            <li>
              I understand that providing false or misleading information may constitute
              an offence under Australian consumer law and state motor vehicle regulations.
            </li>
            <li>
              I consent to the purchaser or their agent conducting any necessary checks
              on the vehicle, including but not limited to PPSR searches, registration
              checks, and vehicle history reports.
            </li>
          </ol>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3 min-h-[44px]">
          <div className="pt-0.5">
            <Checkbox
              checked={formData.declarationAgreed}
              onCheckedChange={(checked: boolean) =>
                onChange("declarationAgreed", checked)
              }
              className="h-5 w-5"
            />
          </div>
          <Label className="text-sm leading-relaxed cursor-pointer font-normal">
            I have read and agree to the above declaration <span className="text-red-500">*</span>
          </Label>
        </div>

        <div className="flex items-start gap-3 min-h-[44px]">
          <div className="pt-0.5">
            <Checkbox
              checked={formData.consentAgreed}
              onCheckedChange={(checked: boolean) =>
                onChange("consentAgreed", checked)
              }
              className="h-5 w-5"
            />
          </div>
          <Label className="text-sm leading-relaxed cursor-pointer font-normal">
            I consent to the collection and processing of my identity documents for
            verification purposes in accordance with the Privacy Act 1988 <span className="text-red-500">*</span>
          </Label>
        </div>
      </div>

      <div className="border-t border-border pt-5 mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signatureName" className="text-sm font-medium">
            Type Your Full Name as Signature <span className="text-red-500">*</span>
          </Label>
          <Input
            id="signatureName"
            value={formData.signatureName}
            onChange={(e) => onChange("signatureName", e.target.value)}
            placeholder="Type your full legal name"
            className="py-3 h-auto text-base"
          />
        </div>

        {formData.signatureName && (
          <div className="rounded-lg border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground mb-2">Signature Preview</p>
            <p
              className="text-2xl text-foreground"
              style={{ fontFamily: "'Georgia', 'Times New Roman', cursive", fontStyle: "italic" }}
            >
              {formData.signatureName}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Date</Label>
          <Input
            value={today}
            readOnly
            disabled
            className="py-3 h-auto text-base bg-muted/30"
          />
        </div>
      </div>
    </div>
  );
}
