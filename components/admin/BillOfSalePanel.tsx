"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  Eye,
  Clock,
  RotateCcw,
} from "lucide-react"

interface BillOfSale {
  id: string
  vehicleId: string
  sellerFullName: string
  sellerAddress: string | null
  sellerSuburb: string | null
  sellerState: string | null
  sellerPostcode: string | null
  sellerCustomerId: string | null
  sellerDob: string | null
  sellerPhone: string
  sellerEmail: string
  sellerLicenceNumber: string | null
  registrationNumber: string
  stateOfRegistration: string | null
  vinNumber: string
  engineNumber: string | null
  yearOfManufacture: number
  vehicleMake: string
  vehicleModel: string
  vehicleVariant: string | null
  bodyType: string | null
  colour: string | null
  fuelType: string | null
  transmission: string | null
  odometerReading: number
  numberOfKeys: string | null
  purchasePrice: number
  depositPaid: number
  balanceDue: number
  paymentMethod: string | null
  dateOfSale: string
  knownDefects: string | null
  status: string
  signingToken: string | null
  tokenExpiresAt: string | null
  sentAt: string | null
  viewedAt: string | null
  signedAt: string | null
  signerName: string | null
  notes: string | null
  createdAt: string
  events?: { id: string; action: string; createdAt: string; ipAddress?: string; userId?: string }[]
}

interface BillOfSalePanelProps {
  vehicleId: string
  vehicleInfo: {
    sellerName: string
    sellerEmail: string
    sellerPhone: string
    purchasePrice: number | null
    year: number
    make: string
    model: string
    vin: string
    registrationNumber: string
    odometer: number
  }
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700 border-yellow-200",
  SENT: "bg-blue-100 text-blue-700 border-blue-200",
  VIEWED: "bg-purple-100 text-purple-700 border-purple-200",
  SIGNED: "bg-green-100 text-green-700 border-green-200",
}

export function BillOfSalePanel({ vehicleId, vehicleInfo }: BillOfSalePanelProps) {
  const [bos, setBos] = useState<BillOfSale | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [signingLink, setSigningLink] = useState("")
  const [copied, setCopied] = useState(false)
  const [showEvents, setShowEvents] = useState(false)

  // Form state
  const [purchasePrice, setPurchasePrice] = useState("")
  const [depositPaid, setDepositPaid] = useState("0")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [knownDefects, setKnownDefects] = useState("")
  const [notes, setNotes] = useState("")
  const [numberOfKeys, setNumberOfKeys] = useState("")

  const fetchBos = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/bill-of-sale-doc`)
      if (res.ok) {
        const data = await res.json()
        setBos(data)
        if (data) {
          setPurchasePrice(String(data.purchasePrice))
          setDepositPaid(String(data.depositPaid))
          setPaymentMethod(data.paymentMethod || "")
          setKnownDefects(data.knownDefects || "")
          setNotes(data.notes || "")
          setNumberOfKeys(data.numberOfKeys || "")
          if (data.signingToken) {
            setSigningLink(`${window.location.origin}/sign-bos/${data.signingToken}`)
          }
        }
      }
    } catch {
      console.error("Failed to fetch Bill of Sale")
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => { fetchBos() }, [fetchBos])

  useEffect(() => {
    if (!loading && !bos && vehicleInfo.purchasePrice) {
      setPurchasePrice(String(vehicleInfo.purchasePrice))
    }
  }, [loading, bos, vehicleInfo.purchasePrice])

  async function handleSave() {
    setError("")
    setSaving(true)
    try {
      const price = parseFloat(purchasePrice)
      const deposit = parseFloat(depositPaid) || 0
      const res = await fetch(`/api/vehicles/${vehicleId}/bill-of-sale-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchasePrice: price,
          depositPaid: deposit,
          balanceDue: price - deposit,
          paymentMethod: paymentMethod || null,
          knownDefects: knownDefects || null,
          notes: notes || null,
          numberOfKeys: numberOfKeys || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save")
        return
      }
      const data = await res.json()
      setBos(data)
      setEditing(false)
      if (data.signingToken) {
        setSigningLink(`${window.location.origin}/sign-bos/${data.signingToken}`)
      }
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function handleSend() {
    setError("")
    setSending(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/bill-of-sale-doc/send`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to send")
        return
      }
      const data = await res.json()
      setBos(data.billOfSale)
      setSigningLink(data.signingLink)
    } catch {
      setError("Network error")
    } finally {
      setSending(false)
    }
  }

  function copyLink() {
    if (!signingLink) return
    navigator.clipboard.writeText(signingLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openWhatsApp() {
    const text = `Please review and sign the Bill of Sale: ${signingLink}`
    const phone = bos?.sellerPhone?.replace(/[^0-9+]/g, "") || ""
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
  }

  function openSms() {
    const text = `Please review and sign the Bill of Sale: ${signingLink}`
    const phone = bos?.sellerPhone || ""
    window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
  }

  function openPreview() {
    window.open(`/api/vehicles/${vehicleId}/bill-of-sale-doc/download`, "_blank")
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

  const showForm = !bos || bos.status === "DRAFT" || editing
  const showLinkSection = signingLink && bos && bos.status !== "SIGNED"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Bill of Sale</CardTitle>
          {bos && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[bos.status] || ""}`}>
              {bos.status}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        {/* ── SIGNED state ── */}
        {bos?.status === "SIGNED" && !editing && (
          <>
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-green-600 mb-1" />
              <p className="text-sm font-medium text-green-700">Bill of Sale Signed</p>
            </div>
            <SummaryRow label="Price" value={`$${Number(bos.purchasePrice).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} />
            <SummaryRow label="Seller" value={bos.sellerFullName} />
            {bos.signerName && <SummaryRow label="Signed by" value={bos.signerName} />}
            {bos.signedAt && (
              <SummaryRow label="Signed" value={new Date(bos.signedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })} />
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={openPreview}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download Signed PDF
            </Button>
          </>
        )}

        {/* ── SENT/VIEWED state ── */}
        {(bos?.status === "SENT" || bos?.status === "VIEWED") && !editing && (
          <>
            <SummaryRow label="Price" value={`$${Number(bos.purchasePrice).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} />
            <SummaryRow label="Seller" value={bos.sellerFullName} />
            <SummaryRow label="Email" value={bos.sellerEmail} />
            {bos.sentAt && (
              <SummaryRow label="Sent" value={new Date(bos.sentAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })} />
            )}
            {bos.viewedAt && (
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <Eye className="h-3 w-3" />
                Viewed: {new Date(bos.viewedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })}
              </div>
            )}

            {showLinkSection && <SigningLinkBlock link={signingLink} copied={copied} onCopy={copyLink} onWhatsApp={openWhatsApp} onSms={openSms} />}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                Resend
              </Button>
              <Button variant="outline" size="sm" onClick={openPreview}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit Details
            </Button>
          </>
        )}

        {/* ── DRAFT / Create / Edit form ── */}
        {showForm && bos?.status !== "SENT" && bos?.status !== "VIEWED" && bos?.status !== "SIGNED" && (
          <>
            <BosForm
              purchasePrice={purchasePrice} setPurchasePrice={setPurchasePrice}
              depositPaid={depositPaid} setDepositPaid={setDepositPaid}
              paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
              knownDefects={knownDefects} setKnownDefects={setKnownDefects}
              numberOfKeys={numberOfKeys} setNumberOfKeys={setNumberOfKeys}
              notes={notes} setNotes={setNotes}
            />
            <Button className="w-full" size="sm" onClick={handleSave} disabled={saving || !purchasePrice}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
              {bos ? "Save Changes" : "Create Bill of Sale"}
            </Button>

            {bos?.status === "DRAFT" && (
              <>
                {showLinkSection && <SigningLinkBlock link={signingLink} copied={copied} onCopy={copyLink} onWhatsApp={openWhatsApp} onSms={openSms} />}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={openPreview}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Preview PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSend} disabled={sending}>
                    {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                    Send to Seller
                  </Button>
                </div>
              </>
            )}

            {editing && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditing(false)}>Cancel Edit</Button>
            )}
          </>
        )}

        {/* ── Edit form for SENT/VIEWED/SIGNED when editing ── */}
        {editing && (bos?.status === "SENT" || bos?.status === "VIEWED" || bos?.status === "SIGNED") && (
          <>
            <BosForm
              purchasePrice={purchasePrice} setPurchasePrice={setPurchasePrice}
              depositPaid={depositPaid} setDepositPaid={setDepositPaid}
              paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
              knownDefects={knownDefects} setKnownDefects={setKnownDefects}
              numberOfKeys={numberOfKeys} setNumberOfKeys={setNumberOfKeys}
              notes={notes} setNotes={setNotes}
            />
            <Button className="w-full" size="sm" onClick={handleSave} disabled={saving || !purchasePrice}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditing(false)}>Cancel</Button>
          </>
        )}

        {/* ── Event log ── */}
        {bos?.events && bos.events.length > 0 && (
          <div>
            <button onClick={() => setShowEvents(!showEvents)} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {showEvents ? "Hide" : "Show"} audit trail ({bos.events.length})
            </button>
            {showEvents && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {bos.events.map((e) => (
                  <div key={e.id} className="text-[10px] text-gray-500 flex justify-between">
                    <span className="font-medium">{e.action}</span>
                    <span>{new Date(e.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
  link, copied, onCopy, onWhatsApp, onSms,
}: {
  link: string; copied: boolean; onCopy: () => void; onWhatsApp: () => void; onSms: () => void
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
      <p className="text-[11px] font-medium text-blue-700">Signing Link (send to seller):</p>
      <div className="flex items-center gap-1.5">
        <input readOnly value={link} className="flex-1 text-[11px] font-mono bg-white border rounded px-2 py-1.5 text-gray-700 truncate" onClick={(e) => (e.target as HTMLInputElement).select()} />
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={onCopy}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      {copied && <p className="text-[10px] text-green-600 font-medium">Copied!</p>}
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={onCopy}>
          <Copy className="mr-1 h-3 w-3" />Copy
        </Button>
        <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={onWhatsApp}>
          <MessageSquare className="mr-1 h-3 w-3" />WhatsApp
        </Button>
        <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={onSms}>
          <ExternalLink className="mr-1 h-3 w-3" />SMS
        </Button>
      </div>
    </div>
  )
}

function BosForm({
  purchasePrice, setPurchasePrice,
  depositPaid, setDepositPaid,
  paymentMethod, setPaymentMethod,
  knownDefects, setKnownDefects,
  numberOfKeys, setNumberOfKeys,
  notes, setNotes,
}: {
  purchasePrice: string; setPurchasePrice: (v: string) => void
  depositPaid: string; setDepositPaid: (v: string) => void
  paymentMethod: string; setPaymentMethod: (v: string) => void
  knownDefects: string; setKnownDefects: (v: string) => void
  numberOfKeys: string; setNumberOfKeys: (v: string) => void
  notes: string; setNotes: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Purchase Price (AUD)</Label>
        <Input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0.00" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Deposit Paid</Label>
          <Input type="number" step="0.01" value={depositPaid} onChange={(e) => setDepositPaid(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs">Balance Due</Label>
          <Input disabled value={(parseFloat(purchasePrice || "0") - parseFloat(depositPaid || "0")).toFixed(2)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Payment Method</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="Cheque">Cheque</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Number of Keys</Label>
        <Input value={numberOfKeys} onChange={(e) => setNumberOfKeys(e.target.value)} placeholder="e.g. 2" />
      </div>
      <div>
        <Label className="text-xs">Known Defects / Conditions</Label>
        <Textarea value={knownDefects} onChange={(e) => setKnownDefects(e.target.value)} placeholder="Describe any known defects..." rows={2} />
      </div>
      <div>
        <Label className="text-xs">Internal Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" rows={2} />
      </div>
    </div>
  )
}
