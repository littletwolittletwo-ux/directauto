"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
// Separator removed — unused
import { toast } from "sonner"
import {
  ArrowLeft,
  Search,
  Loader2,
  Save,
  Car,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"]

interface LookupResult {
  vehicle: {
    vehicle_id: string
    make: string
    model: string
    year: number
    vin: string
    registration_number: string
    colour: string
    engine: string
    transmission: string
    body_type: string
    odometer: number
  }
  valuation: {
    trade_value: number
    retail_value: number
  }
}

interface PPSRResult {
  isWrittenOff: boolean
  isStolen: boolean
  hasFinance: boolean
  encumbered: boolean
}

export default function AcquireVehiclePage() {
  const router = useRouter()

  // Lookup state
  const [query, setQuery] = useState("")
  const [state, setState] = useState("VIC")
  const [lookupOdometer, setLookupOdometer] = useState("")
  const [searching, setSearching] = useState(false)
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)

  // PPSR state
  const [ppsrResult, setPpsrResult] = useState<PPSRResult | null>(null)
  const [ppsrLoading, setPpsrLoading] = useState(false)
  const [ppsrError, setPpsrError] = useState<string | null>(null)

  // Form state (auto-filled from lookup + manual entry)
  const [form, setForm] = useState({
    make: "",
    model: "",
    year: "",
    vin: "",
    registrationNumber: "",
    colour: "",
    engine: "",
    transmission: "",
    bodyType: "",
    odometer: "",
    tradeValue: "",
    retailValue: "",
    askingPrice: "",
    offerPrice: "",
    sellerName: "",
    sellerPhone: "",
    sellerEmail: "",
    sellerAddress: "",
    notes: "",
    autograbVehicleId: "",
  })

  const [submitting, setSubmitting] = useState(false)

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleLookup() {
    if (!query.trim()) {
      toast.error("Enter a VIN or rego plate")
      return
    }

    setSearching(true)
    setLookupResult(null)
    setPpsrResult(null)
    setPpsrError(null)

    try {
      const isVin = query.trim().length === 17
      const res = await fetch("/api/autograb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          state,
          type: isVin ? "vin" : "rego",
          odometer: lookupOdometer ? parseInt(lookupOdometer, 10) : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Lookup failed")
      }

      const data: LookupResult = await res.json()
      setLookupResult(data)

      // Auto-fill form — use query as rego fallback if lookup was by rego
      const regoFallback = !isVin ? query.trim() : ''
      setForm((prev) => ({
        ...prev,
        make: data.vehicle.make || prev.make,
        model: data.vehicle.model || prev.model,
        year: data.vehicle.year ? String(data.vehicle.year) : prev.year,
        vin: data.vehicle.vin || prev.vin,
        registrationNumber: data.vehicle.registration_number || regoFallback || prev.registrationNumber,
        colour: data.vehicle.colour || prev.colour,
        engine: data.vehicle.engine || prev.engine,
        transmission: data.vehicle.transmission || prev.transmission,
        bodyType: data.vehicle.body_type || prev.bodyType,
        odometer: lookupOdometer || (data.vehicle.odometer ? String(data.vehicle.odometer) : prev.odometer),
        tradeValue: data.valuation.trade_value ? String(data.valuation.trade_value) : prev.tradeValue,
        retailValue: data.valuation.retail_value ? String(data.valuation.retail_value) : prev.retailValue,
        autograbVehicleId: data.vehicle.vehicle_id || prev.autograbVehicleId,
      }))

      toast.success("Vehicle found")

      // Auto-run PPSR via Car Analysis if VIN available
      if (data.vehicle.vin) {
        runPPSR(data.vehicle.vin, data.vehicle.registration_number)
      }
    } catch (err: any) {
      toast.error(err.message || "Vehicle lookup failed")
    } finally {
      setSearching(false)
    }
  }

  async function runPPSR(vin?: string, rego?: string) {
    const vinToCheck = vin || form.vin
    if (!vinToCheck && !rego) {
      toast.error("VIN or rego required for PPSR check")
      return
    }

    setPpsrLoading(true)
    setPpsrError(null)

    try {
      // Call Autograb Car Analysis (with PPSR Cloud fallback)
      const res = await fetch("/api/autograb/ppsr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: vinToCheck || undefined,
          rego: rego || form.registrationNumber || undefined,
          state,
          odometer: lookupOdometer || form.odometer || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "PPSR check failed")
      }

      const data = await res.json()
      setPpsrResult(data)

      if (data.isWrittenOff || data.isStolen || data.hasFinance) {
        toast.error("PPSR flags detected!")
      } else {
        toast.success("PPSR check clear")
      }
    } catch (err: any) {
      setPpsrError(err.message || "PPSR check failed")
      toast.error(err.message || "PPSR check failed")
    } finally {
      setPpsrLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Basic validation
    if (!form.vin || !form.make || !form.model || !form.year || !form.odometer) {
      toast.error("Fill in at least VIN, Make, Model, Year, and Odometer")
      return
    }
    if (!form.sellerName || !form.sellerPhone || !form.sellerEmail) {
      toast.error("Seller contact details are required")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: form.vin.toUpperCase(),
          registrationNumber: form.registrationNumber,
          make: form.make,
          model: form.model,
          year: form.year,
          odometer: form.odometer,
          sellerName: form.sellerName,
          sellerPhone: form.sellerPhone,
          sellerEmail: form.sellerEmail,
          sellerPrice: form.askingPrice || null,
          location: "",
          autograbVehicleId: form.autograbVehicleId || null,
          autograbTradeValue: form.tradeValue || null,
          autograbRetailValue: form.retailValue || null,
          autograbColour: form.colour || null,
          autograbEngine: form.engine || null,
          autograbTransmission: form.transmission || null,
          autograbBodyType: form.bodyType || null,
          offerPrice: form.offerPrice || null,
          purchasePrice: form.offerPrice || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create vehicle")
      }

      const vehicle = await res.json()

      // If we have PPSR results, save them
      if (ppsrResult) {
        await fetch(`/api/vehicles/${vehicle.id}/ppsr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isWrittenOff: ppsrResult.isWrittenOff,
            isStolen: ppsrResult.isStolen,
            hasFinance: ppsrResult.hasFinance,
            status: "COMPLETED",
          }),
        })
      }

      toast.success(`Vehicle created: ${vehicle.confirmationNumber}`)
      router.push(`/admin/vehicles/${vehicle.id}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to create vehicle")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Link>
        <h1 className="text-xl font-semibold">Acquire Vehicle</h1>
      </div>

      {/* Lookup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Vehicle Lookup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Enter VIN (17 chars) or Rego plate"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                className="uppercase"
              />
            </div>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Odometer (km)"
              value={lookupOdometer}
              onChange={(e) => setLookupOdometer(e.target.value)}
              className="w-[140px]"
              min={0}
            />
            <Button onClick={handleLookup} disabled={searching}>
              {searching ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-4 w-4" />
              )}
              {searching ? "Looking up..." : "Look Up Vehicle"}
            </Button>
          </div>

          {lookupResult && (
            <div className="mt-4 rounded-lg border bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800">
                {lookupResult.vehicle.make || lookupResult.vehicle.model
                  ? `Found: ${lookupResult.vehicle.year || ''} ${lookupResult.vehicle.make} ${lookupResult.vehicle.model}`.trim()
                  : 'Vehicle found — details populated below'}
              </p>
              {(lookupResult.vehicle.vin || lookupResult.vehicle.registration_number) && (
                <p className="text-xs text-green-700">
                  {lookupResult.vehicle.vin ? `VIN: ${lookupResult.vehicle.vin}` : ''}
                  {lookupResult.vehicle.vin && lookupResult.vehicle.registration_number ? ' | ' : ''}
                  {lookupResult.vehicle.registration_number ? `Rego: ${lookupResult.vehicle.registration_number}` : ''}
                </p>
              )}
              {lookupResult.valuation.trade_value > 0 && (
                <p className="text-xs text-green-700 mt-1">
                  Trade: ${lookupResult.valuation.trade_value.toLocaleString()} | Retail: ${lookupResult.valuation.retail_value.toLocaleString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PPSR Result Banner */}
      {ppsrLoading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">Running PPSR / Car Analysis check...</p>
            <p className="text-xs text-blue-600">This may take up to 30 seconds</p>
          </div>
        </div>
      )}
      {ppsrError && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">PPSR check failed</p>
            <p className="text-xs text-yellow-600">{ppsrError}</p>
          </div>
        </div>
      )}
      {ppsrResult && !ppsrResult.isWrittenOff && !ppsrResult.isStolen && !ppsrResult.hasFinance && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">PPSR Clear — No issues found</p>
            <p className="text-xs text-green-600">No finance, no write-off, no stolen records</p>
          </div>
        </div>
      )}
      {ppsrResult && ppsrResult.hasFinance && !ppsrResult.isWrittenOff && !ppsrResult.isStolen && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-orange-800">Finance Owing — Proceed with caution</p>
            <p className="text-xs text-orange-600">This vehicle has finance registered on the PPSR. Ensure finance is discharged before purchase.</p>
          </div>
        </div>
      )}
      {ppsrResult && (ppsrResult.isWrittenOff || ppsrResult.isStolen) && (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 p-4 flex items-center gap-3">
          <AlertTriangle className="h-7 w-7 text-red-600 shrink-0" />
          <div>
            <p className="text-base font-bold text-red-800">
              WARNING — {ppsrResult.isStolen ? "Vehicle is recorded as STOLEN" : "Vehicle is recorded as WRITTEN OFF"}
              {ppsrResult.isStolen && ppsrResult.isWrittenOff ? " and WRITTEN OFF" : ""}
            </p>
            <p className="text-sm text-red-600 font-medium">Do not proceed with this acquisition!</p>
          </div>
        </div>
      )}

      {/* Vehicle Details Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Make *</Label>
                <Input
                  value={form.make}
                  onChange={(e) => handleChange("make", e.target.value)}
                  placeholder="e.g. Toyota"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Model *</Label>
                <Input
                  value={form.model}
                  onChange={(e) => handleChange("model", e.target.value)}
                  placeholder="e.g. Camry"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Year *</Label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => handleChange("year", e.target.value)}
                  placeholder="e.g. 2022"
                />
              </div>
              <div className="space-y-1.5">
                <Label>VIN *</Label>
                <Input
                  value={form.vin}
                  onChange={(e) => handleChange("vin", e.target.value.toUpperCase())}
                  placeholder="17-character VIN"
                  maxLength={17}
                  className="uppercase font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Registration</Label>
                <Input
                  value={form.registrationNumber}
                  onChange={(e) =>
                    handleChange("registrationNumber", e.target.value.toUpperCase())
                  }
                  placeholder="e.g. ABC123"
                  className="uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Colour</Label>
                <Input
                  value={form.colour}
                  onChange={(e) => handleChange("colour", e.target.value)}
                  placeholder="e.g. White"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Engine</Label>
                <Input
                  value={form.engine}
                  onChange={(e) => handleChange("engine", e.target.value)}
                  placeholder="e.g. 2.5L Petrol"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Transmission</Label>
                <Input
                  value={form.transmission}
                  onChange={(e) => handleChange("transmission", e.target.value)}
                  placeholder="e.g. Automatic"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Body Type</Label>
                <Input
                  value={form.bodyType}
                  onChange={(e) => handleChange("bodyType", e.target.value)}
                  placeholder="e.g. Sedan"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Odometer (km) *</Label>
                <Input
                  type="number"
                  value={form.odometer}
                  onChange={(e) => handleChange("odometer", e.target.value)}
                  placeholder="e.g. 50000"
                  min={0}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valuation */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Valuation & Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">
                  Autograb Trade Value
                </Label>
                <Input
                  type="number"
                  value={form.tradeValue}
                  onChange={(e) => handleChange("tradeValue", e.target.value)}
                  placeholder="$0"
                  min={0}
                  step="0.01"
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">
                  Autograb Retail Value
                </Label>
                <Input
                  type="number"
                  value={form.retailValue}
                  onChange={(e) => handleChange("retailValue", e.target.value)}
                  placeholder="$0"
                  min={0}
                  step="0.01"
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Asking Price (seller wants)</Label>
                <Input
                  type="number"
                  value={form.askingPrice}
                  onChange={(e) => handleChange("askingPrice", e.target.value)}
                  placeholder="$0"
                  min={0}
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Our Offer Price</Label>
                <Input
                  type="number"
                  value={form.offerPrice}
                  onChange={(e) => handleChange("offerPrice", e.target.value)}
                  placeholder="$0"
                  min={0}
                  step="0.01"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seller Details */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Seller Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  value={form.sellerName}
                  onChange={(e) => handleChange("sellerName", e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input
                  type="tel"
                  value={form.sellerPhone}
                  onChange={(e) => handleChange("sellerPhone", e.target.value)}
                  placeholder="04xx xxx xxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.sellerEmail}
                  onChange={(e) => handleChange("sellerEmail", e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={form.sellerAddress}
                onChange={(e) => handleChange("sellerAddress", e.target.value)}
                placeholder="123 Main St, Suburb VIC 3000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Any additional notes about this acquisition..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={submitting || (ppsrResult?.isStolen === true) || (ppsrResult?.isWrittenOff === true)}
          >
            {submitting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {ppsrResult?.isStolen || ppsrResult?.isWrittenOff
              ? "Blocked — PPSR Issue"
              : submitting
              ? "Creating..."
              : "Create Vehicle Record"}
          </Button>
        </div>
      </form>
    </div>
  )
}
