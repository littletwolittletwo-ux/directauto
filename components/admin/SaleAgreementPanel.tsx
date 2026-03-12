"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  FileText,
  Send,
  Download,
  CheckCircle2,
  Loader2,
  Pencil,
} from "lucide-react"

interface SaleAgreement {
  id: string
  vehicleId: string
  salePrice: number
  buyerName: string
  buyerEmail: string
  buyerPhone: string | null
  buyerAddress: string | null
  agreementDate: string
  sentAt: string | null
  sentById: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface SaleAgreementPanelProps {
  vehicleId: string
  vehicleInfo: {
    sellerName: string
    sellerEmail: string
    sellerPrice: number | null
    year: number
    make: string
    model: string
  }
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700 border-yellow-200",
  SENT: "bg-blue-100 text-blue-700 border-blue-200",
  SIGNED: "bg-green-100 text-green-700 border-green-200",
}

export function SaleAgreementPanel({
  vehicleId,
  vehicleInfo,
}: SaleAgreementPanelProps) {
  const [agreement, setAgreement] = useState<SaleAgreement | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [salePrice, setSalePrice] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [buyerPhone, setBuyerPhone] = useState("")
  const [buyerAddress, setBuyerAddress] = useState("")
  const [notes, setNotes] = useState("")

  const fetchAgreement = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/sale-agreement`)
      if (res.ok) {
        const data = await res.json()
        setAgreement(data)
        if (data) {
          setSalePrice(String(data.salePrice))
          setBuyerName(data.buyerName)
          setBuyerEmail(data.buyerEmail)
          setBuyerPhone(data.buyerPhone || "")
          setBuyerAddress(data.buyerAddress || "")
          setNotes(data.notes || "")
        }
      }
    } catch {
      console.error("Failed to fetch sale agreement")
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchAgreement()
  }, [fetchAgreement])

  // Pre-fill price from vehicle if no agreement exists
  useEffect(() => {
    if (!loading && !agreement && vehicleInfo.sellerPrice) {
      setSalePrice(String(vehicleInfo.sellerPrice))
    }
  }, [loading, agreement, vehicleInfo.sellerPrice])

  async function handleSave() {
    setError("")
    setSaving(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/sale-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salePrice,
          buyerName,
          buyerEmail,
          buyerPhone,
          buyerAddress,
          notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save")
        return
      }
      const data = await res.json()
      setAgreement(data)
      setEditing(false)
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function handleSend() {
    if (!confirm("Send the sale agreement PDF to the buyer via email?")) return
    setError("")
    setSending(true)
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/sale-agreement/send`,
        { method: "POST" }
      )
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to send")
        return
      }
      const data = await res.json()
      setAgreement(data)
    } catch {
      setError("Network error")
    } finally {
      setSending(false)
    }
  }

  async function handleMarkSigned() {
    if (!confirm("Mark this sale agreement as signed?")) return
    setError("")
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/sale-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SIGNED" }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to update")
        return
      }
      const data = await res.json()
      setAgreement(data)
    } catch {
      setError("Network error")
    }
  }

  function openPreview() {
    window.open(`/api/vehicles/${vehicleId}/sale-agreement/download`, "_blank")
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const showForm = !agreement || agreement.status === "DRAFT" || editing

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Sale Agreement
          </CardTitle>
          {agreement && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[agreement.status] || ""}`}
            >
              {agreement.status}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* ── SIGNED state ── */}
        {agreement?.status === "SIGNED" && !editing && (
          <>
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-green-600 mb-1" />
              <p className="text-sm font-medium text-green-700">
                Agreement Signed
              </p>
            </div>
            <SummaryRow label="Price" value={`$${Number(agreement.salePrice).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} />
            <SummaryRow label="Buyer" value={agreement.buyerName} />
            <SummaryRow label="Email" value={agreement.buyerEmail} />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={openPreview}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download PDF
            </Button>
          </>
        )}

        {/* ── SENT state ── */}
        {agreement?.status === "SENT" && !editing && (
          <>
            <SummaryRow label="Price" value={`$${Number(agreement.salePrice).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} />
            <SummaryRow label="Buyer" value={agreement.buyerName} />
            <SummaryRow label="Email" value={agreement.buyerEmail} />
            {agreement.sentAt && (
              <SummaryRow
                label="Sent"
                value={new Date(agreement.sentAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Resend
              </Button>
              <Button variant="outline" size="sm" onClick={openPreview}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleMarkSigned}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Mark as Signed
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit Details
            </Button>
          </>
        )}

        {/* ── DRAFT / Create / Edit form ── */}
        {showForm && agreement?.status !== "SENT" && agreement?.status !== "SIGNED" && (
          <>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Sale Price (AUD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-xs">Buyer Name</Label>
                <Input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Full legal name"
                />
              </div>
              <div>
                <Label className="text-xs">Buyer Email</Label>
                <Input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="buyer@example.com"
                />
              </div>
              <div>
                <Label className="text-xs">Buyer Phone</Label>
                <Input
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label className="text-xs">Buyer Address</Label>
                <Textarea
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  placeholder="Optional"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes (optional)"
                  rows={2}
                />
              </div>
            </div>

            <Button
              className="w-full"
              size="sm"
              onClick={handleSave}
              disabled={saving || !salePrice || !buyerName || !buyerEmail}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-3.5 w-3.5" />
              )}
              {agreement ? "Save Changes" : "Create Draft"}
            </Button>

            {agreement?.status === "DRAFT" && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={openPreview}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Preview PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Send to Buyer
                </Button>
              </div>
            )}

            {editing && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setEditing(false)}
              >
                Cancel Edit
              </Button>
            )}
          </>
        )}

        {/* ── Edit form for SENT/SIGNED when editing flag is set ── */}
        {editing && (agreement?.status === "SENT" || agreement?.status === "SIGNED") && (
          <>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Sale Price (AUD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Buyer Name</Label>
                <Input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Buyer Email</Label>
                <Input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Buyer Phone</Label>
                <Input
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Buyer Address</Label>
                <Textarea
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <Button
              className="w-full"
              size="sm"
              onClick={handleSave}
              disabled={saving || !salePrice || !buyerName || !buyerEmail}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">
        {value}
      </span>
    </div>
  )
}
