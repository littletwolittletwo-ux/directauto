"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Step2Props {
  formData: {
    sellerName: string;
    sellerPhone: string;
    sellerEmail: string;
    sellerAddress: string;
    isCompanyVehicle: boolean;
    companyName: string;
    companyAbn: string;
  };
  onChange: (field: string, value: string | boolean) => void;
}

export default function Step2SellerDetails({ formData, onChange }: Step2Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="sellerName" className="text-sm font-medium">
          Full Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="sellerName"
          value={formData.sellerName}
          onChange={(e) => onChange("sellerName", e.target.value)}
          placeholder="e.g. John Smith"
          autoComplete="name"
          className="py-3 h-auto text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sellerPhone" className="text-sm font-medium">
          Phone Number <span className="text-red-500">*</span>
        </Label>
        <Input
          id="sellerPhone"
          type="tel"
          value={formData.sellerPhone}
          onChange={(e) => onChange("sellerPhone", e.target.value)}
          placeholder="e.g. 0412 345 678"
          autoComplete="tel"
          className="py-3 h-auto text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sellerEmail" className="text-sm font-medium">
          Email Address <span className="text-red-500">*</span>
        </Label>
        <Input
          id="sellerEmail"
          type="email"
          value={formData.sellerEmail}
          onChange={(e) => onChange("sellerEmail", e.target.value)}
          placeholder="e.g. john@example.com"
          autoComplete="email"
          className="py-3 h-auto text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sellerAddress" className="text-sm font-medium">
          Residential Address <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="sellerAddress"
          value={formData.sellerAddress}
          onChange={(e) => onChange("sellerAddress", e.target.value)}
          placeholder="Enter your full residential address"
          autoComplete="street-address"
          rows={3}
          className="py-3 text-base min-h-[80px]"
        />
      </div>

      {/* Company vehicle section */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isCompanyVehicle}
            onChange={(e) => onChange("isCompanyVehicle", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 font-medium">
            This vehicle is registered under a company name
          </span>
        </label>

        {formData.isCompanyVehicle && (
          <div className="space-y-4 pl-7">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-sm font-medium">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => onChange("companyName", e.target.value)}
                placeholder="e.g. Smith Trading Pty Ltd"
                className="py-3 h-auto text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAbn" className="text-sm font-medium">
                ABN <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyAbn"
                value={formData.companyAbn}
                onChange={(e) => onChange("companyAbn", e.target.value)}
                placeholder="e.g. 12 345 678 901"
                className="py-3 h-auto text-base"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A tax invoice will be automatically generated when the sale is finalised.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
