"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Save, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface FormData {
  vin: string
  registrationNumber: string
  make: string
  model: string
  year: string
  odometer: string
  sellerName: string
  sellerPhone: string
  sellerEmail: string
  sellerPrice: string
  location: string
}

const initialForm: FormData = {
  vin: "",
  registrationNumber: "",
  make: "",
  model: "",
  year: "",
  odometer: "",
  sellerName: "",
  sellerPhone: "",
  sellerEmail: "",
  sellerPrice: "",
  location: "",
}

export default function NewVehiclePage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!form.vin.trim()) newErrors.vin = "VIN is required"
    else if (form.vin.trim().length !== 17)
      newErrors.vin = "VIN must be 17 characters"
    if (!form.registrationNumber.trim())
      newErrors.registrationNumber = "Registration number is required"
    if (!form.make.trim()) newErrors.make = "Make is required"
    if (!form.model.trim()) newErrors.model = "Model is required"
    if (!form.year.trim()) newErrors.year = "Year is required"
    else {
      const y = parseInt(form.year, 10)
      if (isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1)
        newErrors.year = "Invalid year"
    }
    if (!form.odometer.trim()) newErrors.odometer = "Odometer is required"
    else if (isNaN(parseInt(form.odometer, 10)) || parseInt(form.odometer, 10) < 0)
      newErrors.odometer = "Invalid odometer"
    if (!form.sellerName.trim()) newErrors.sellerName = "Seller name is required"
    if (!form.sellerPhone.trim())
      newErrors.sellerPhone = "Seller phone is required"
    if (!form.sellerEmail.trim())
      newErrors.sellerEmail = "Seller email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.sellerEmail.trim()))
      newErrors.sellerEmail = "Invalid email address"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: form.vin.trim().toUpperCase(),
          registrationNumber: form.registrationNumber.trim(),
          make: form.make.trim(),
          model: form.model.trim(),
          year: form.year.trim(),
          odometer: form.odometer.trim(),
          sellerName: form.sellerName.trim(),
          sellerPhone: form.sellerPhone.trim(),
          sellerEmail: form.sellerEmail.trim(),
          sellerPrice: form.sellerPrice.trim() || null,
          location: form.location.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create vehicle")
      }

      const vehicle = await res.json()
      toast.success(
        `Vehicle created: ${vehicle.confirmationNumber}`
      )
      router.push(`/admin/vehicles/${vehicle.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create vehicle"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/vehicles"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Link>
        <h1 className="text-xl font-semibold">Add Vehicle Manually</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vin">VIN *</Label>
                <Input
                  id="vin"
                  value={form.vin}
                  onChange={(e) => handleChange("vin", e.target.value)}
                  placeholder="17-character VIN"
                  maxLength={17}
                  className="uppercase"
                />
                {errors.vin && (
                  <p className="text-xs text-red-500">{errors.vin}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rego">Registration Number *</Label>
                <Input
                  id="rego"
                  value={form.registrationNumber}
                  onChange={(e) =>
                    handleChange("registrationNumber", e.target.value)
                  }
                  placeholder="e.g. ABC123"
                />
                {errors.registrationNumber && (
                  <p className="text-xs text-red-500">
                    {errors.registrationNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  value={form.make}
                  onChange={(e) => handleChange("make", e.target.value)}
                  placeholder="e.g. Toyota"
                />
                {errors.make && (
                  <p className="text-xs text-red-500">{errors.make}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={(e) => handleChange("model", e.target.value)}
                  placeholder="e.g. Camry"
                />
                {errors.model && (
                  <p className="text-xs text-red-500">{errors.model}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  type="number"
                  value={form.year}
                  onChange={(e) => handleChange("year", e.target.value)}
                  placeholder="e.g. 2022"
                  min={1900}
                  max={new Date().getFullYear() + 1}
                />
                {errors.year && (
                  <p className="text-xs text-red-500">{errors.year}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="odometer">Odometer (km) *</Label>
                <Input
                  id="odometer"
                  type="number"
                  value={form.odometer}
                  onChange={(e) => handleChange("odometer", e.target.value)}
                  placeholder="e.g. 50000"
                  min={0}
                />
                {errors.odometer && (
                  <p className="text-xs text-red-500">{errors.odometer}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sellerPrice">Seller Price ($)</Label>
                <Input
                  id="sellerPrice"
                  type="number"
                  value={form.sellerPrice}
                  onChange={(e) => handleChange("sellerPrice", e.target.value)}
                  placeholder="e.g. 25000"
                  min={0}
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g. Melbourne, VIC"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Seller Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sellerName">Full Name *</Label>
                <Input
                  id="sellerName"
                  value={form.sellerName}
                  onChange={(e) => handleChange("sellerName", e.target.value)}
                  placeholder="John Smith"
                />
                {errors.sellerName && (
                  <p className="text-xs text-red-500">{errors.sellerName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sellerPhone">Phone *</Label>
                <Input
                  id="sellerPhone"
                  type="tel"
                  value={form.sellerPhone}
                  onChange={(e) => handleChange("sellerPhone", e.target.value)}
                  placeholder="04xx xxx xxx"
                />
                {errors.sellerPhone && (
                  <p className="text-xs text-red-500">{errors.sellerPhone}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sellerEmail">Email *</Label>
                <Input
                  id="sellerEmail"
                  type="email"
                  value={form.sellerEmail}
                  onChange={(e) => handleChange("sellerEmail", e.target.value)}
                  placeholder="john@example.com"
                />
                {errors.sellerEmail && (
                  <p className="text-xs text-red-500">{errors.sellerEmail}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Link
            href="/admin/vehicles"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Cancel
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {submitting ? "Creating..." : "Create Vehicle"}
          </Button>
        </div>
      </form>
    </div>
  )
}
