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
  };
  onChange: (field: string, value: string) => void;
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
    </div>
  );
}
