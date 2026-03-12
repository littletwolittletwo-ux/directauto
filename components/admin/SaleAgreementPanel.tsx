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
  Copy,
  MessageSquare,
  ExternalLink,
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
  signingToken: string | null
  signedAt: string | null
  signerName: string | null
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
  const [signingLink, setSigningLink] = useState("")
  const [copied, setCopied] = useState(false)

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
          if (data.signingToken) {
            const base = window.location.origin
            setSigningLink(`${base}/sign/${data.signingToken}`)
          }
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
        body: JSON.stringify({ salePrice, buyerName, buyerEmail, buyerPhone, buyerAddress, notes }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save")
        return
      }
      const data = await res.json()
      setAgreement(data)
      setEditing(false)
      if (data.signingToken) {
        setSigningLink(`${window.location.origin}/sign/${data.signingToken}`)
      }
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateLink() {
    setError("")
    setSending(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/sale-agreement/send`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to generate link")
        return
      }
      const data = await res.json()
      setAgreement(data.agreement)
      setSigningLink(data.signingLink)
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

  function copyLink() {
    if (!signingLink) return
    navigator.clipboard.writeText(signingLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openWhatsApp() {
    const text = `Please sign your vehicle sale agreement: ${signingLink}`
    const phone = agreement?.buyerPhone?.replace(/[^0-9+]/g, "") || ""
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
  }

  function openSms() {
    const text = `Please sign your vehicle sale agreement: ${signingLink}`
    const phone = agreement?.buyerPhone || ""
    window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
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
  const showLinkSection = signingLink && agreement && agreement.status !== "SIGNED"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Sale Agreement</CardTitle>
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
              <p className="text-sm font-medium text-green-700">Agreement Signed</p>
            </div>
            <SummaryRow label="Price" value={`$${Number(agreement.salePrice).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} />
            <SummaryRow label="Buyer" value={agreement.buyerName} />
            {agreement.signerName && (
              <SummaryRow label="Signed by" value={agreement.signerName} />
            )}
            {agreement.signedAt && (
              <SummaryRow
                label="Signed"
                value={new Date(agreement.signedAt).toLocaleDateString("en-AU", {
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              />
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={openPreview}>
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
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              />
            )}

            {/* Signing link section */}
            {showLinkSection && <SigningLinkBlock link={signingLink} copied={copied} onCopy={copyLink} onWhatsApp={openWhatsApp} onSms={openSms} />}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerateLink} disabled={sending}>
                {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                New Link
              </Button>
              <Button variant="outline" size="sm" onClick={openPreview}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={handleMarkSigned}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Mark as Signed
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit Details
            </Button>
          </>
        )}

        {/* ── DRAFT / Create / Edit form ── */}
        {showForm && agreement?.status !== "SENT" && agreement?.status !== "SIGNED" && (
          <>
            <AgreementForm
              salePrice={salePrice} setSalePrice={setSalePrice}
              buyerName={buyerName} setBuyerName={setBuyerName}
              buyerEmail={buyerEmail} setBuyerEmail={setBuyerEmail}
              buyerPhone={buyerPhone} setBuyerPhone={setBuyerPhone}
              buyerAddress={buyerAddress} setBuyerAddress={setBuyerAddress}
              notes={notes} setNotes={setNotes}
            />
            <Button
              className="w-full"
              size="sm"
              onClick={handleSave}
              disabled={saving || !salePrice || !buyerName || !buyerEmail}
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
              {agreement ? "Save Changes" : "Create Draft"}
            </Button>

            {agreement?.status === "DRAFT" && (
              <>
                {/* Signing link if exists */}
                {showLinkSection && <SigningLinkBlock link={signingLink} copied={copied} onCopy={copyLink} onWhatsApp={openWhatsApp} onSms={openSms} />}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={openPreview}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Preview PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleGenerateLink} disabled={sending}>
                    {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                    Send to Buyer
                  </Button>
                </div>
              </>
            )}

            {editing && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditing(false)}>
                Cancel Edit
              </Button>
            )}
          </>
        )}

        {/* ── Edit form for SENT/SIGNED when editing flag is set ── */}
        {editing && (agreement?.status === "SENT" || agreement?.status === "SIGNED") && (
          <>
            <AgreementForm
              salePrice={salePrice} setSalePrice={setSalePrice}
              buyerName={buyerName} setBuyerName={setBuyerName}
              buyerEmail={buyerEmail} setBuyerEmail={setBuyerEmail}
              buyerPhone={buyerPhone} setBuyerPhone={setBuyerPhone}
              buyerAddress={buyerAddress} setBuyerAddress={setBuyerAddress}
              notes={notes} setNotes={setNotes}
            />
            <Button
              className="w-full" size="sm"
              onClick={handleSave}
              disabled={saving || !salePrice || !buyerName || !buyerEmail}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Sub-components ──

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  )
}

function SigningLinkBlock({
  link,
  copied,
  onCopy,
  onWhatsApp,
  onSms,
}: {
  link: string
  copied: boolean
  onCopy: () => void
  onWhatsApp: () => void
  onSms: () => void
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
      <p className="text-[11px] font-medium text-blue-700">Signing Link (send to buyer):</p>
      <div className="flex items-center gap-1.5">
        <input
          readOnly
          value={link}
          className="flex-1 text-[11px] font-mono bg-white border rounded px-2 py-1.5 text-gray-700 truncate"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={onCopy}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      {copied && <p className="text-[10px] text-green-600 font-medium">Copied!</p>}
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={onCopy}>
          <Copy className="mr-1 h-3 w-3" />
          Copy
        </Button>
        <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={onWhatsApp}>
          <MessageSquare className="mr-1 h-3 w-3" />
          WhatsApp
        </Button>
        <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={onSms}>
          <ExternalLink className="mr-1 h-3 w-3" />
          SMS
        </Button>
      </div>
    </div>
  )
}

function AgreementForm({
  salePrice, setSalePrice,
  buyerName, setBuyerName,
  buyerEmail, setBuyerEmail,
  buyerPhone, setBuyerPhone,
  buyerAddress, setBuyerAddress,
  notes, setNotes,
}: {
  salePrice: string; setSalePrice: (v: string) => void
  buyerName: string; setBuyerName: (v: string) => void
  buyerEmail: string; setBuyerEmail: (v: string) => void
  buyerPhone: string; setBuyerPhone: (v: string) => void
  buyerAddress: string; setBuyerAddress: (v: string) => void
  notes: string; setNotes: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Sale Price (AUD)</Label>
        <Input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="0.00" />
      </div>
      <div>
        <Label className="text-xs">Buyer Name</Label>
        <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Full legal name" />
      </div>
      <div>
        <Label className="text-xs">Buyer Email</Label>
        <Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="buyer@example.com" />
      </div>
      <div>
        <Label className="text-xs">Buyer Phone</Label>
        <Input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="Optional" />
      </div>
      <div>
        <Label className="text-xs">Buyer Address</Label>
        <Textarea value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} placeholder="Optional" rows={2} />
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes (optional)" rows={2} />
      </div>
    </div>
  )
}
