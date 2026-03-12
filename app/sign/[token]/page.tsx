"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, Loader2, AlertTriangle, FileText, Download } from "lucide-react"

interface AgreementData {
  status: string
  salePrice: number
  buyerName: string
  buyerEmail: string
  agreementDate: string
  signerName?: string
  signedAt?: string
  vehicle: {
    make: string
    model: string
    year: number
    vin?: string
    registrationNumber?: string
    odometer?: number
    confirmationNumber: string
    sellerName?: string
  }
  ppsr?: {
    isWrittenOff: boolean
    isStolen: boolean
    hasFinance: boolean
    checkedAt: string
  } | null
}

type Step = "review" | "sign" | "complete"

export default function SigningPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<AgreementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [step, setStep] = useState<Step>("review")

  // Signing state
  const [signerName, setSignerName] = useState("")
  const [useTypedSig, setUseTypedSig] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [checks, setChecks] = useState({ read: false, agree: false, confirm: false })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [pdfUrl, setPdfUrl] = useState("")

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sign/${token}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError("This signing link is invalid or has expired.")
        } else {
          const body = await res.json()
          setError(body.error || "Failed to load agreement.")
        }
        return
      }
      const d = await res.json()
      setData(d)
      if (d.status === "SIGNED") {
        setStep("complete")
        setPdfUrl(`/api/sign/${token}/pdf`)
      }
    } catch {
      setError("Failed to connect. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Canvas drawing handlers
  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    setIsDrawing(true)
    setHasDrawn(true)
    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#1e293b"
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function endDraw() {
    setIsDrawing(false)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function handleSign() {
    if (!data) return
    setSubmitError("")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim() }),
      })
      if (!res.ok) {
        const body = await res.json()
        setSubmitError(body.error || "Failed to sign. Please try again.")
        return
      }
      const result = await res.json()
      setData({
        ...data,
        status: "SIGNED",
        signerName: signerName.trim(),
        signedAt: result.signedAt,
      })
      setPdfUrl(result.pdfUrl || `/api/sign/${token}/pdf`)
      setStep("complete")
    } catch {
      setSubmitError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const allChecked = checks.read && checks.agree && checks.confirm
  const sigReady = useTypedSig ? signerName.trim().length >= 2 : hasDrawn
  const canSign = allChecked && sigReady && signerName.trim().length >= 2

  const formatPrice = (p: number) =>
    p.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // ── Loading ──
  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Shell>
    )
  }

  // ── Error (invalid/expired) ──
  if (error || !data) {
    return (
      <Shell>
        <div className="text-center py-16 space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-900">Link Invalid</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            {error || "This signing link is not valid."}
          </p>
          <p className="text-gray-400 text-xs">
            Contact Direct Auto Wholesale if you need assistance.
          </p>
        </div>
      </Shell>
    )
  }

  // ── Progress indicator ──
  const steps: { key: Step; label: string }[] = [
    { key: "review", label: "Review" },
    { key: "sign", label: "Sign" },
    { key: "complete", label: "Complete" },
  ]
  const stepIdx = steps.findIndex((s) => s.key === step)

  return (
    <Shell>
      {/* Progress bar */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                i <= stepIdx
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i < stepIdx ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                i <= stepIdx ? "text-blue-600" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
                  i < stepIdx ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ═══════ STEP 1: REVIEW ═══════ */}
      {step === "review" && (
        <div className="space-y-4">
          {/* Vehicle Details */}
          <InfoCard title="Vehicle Details">
            <Row label="Make" value={data.vehicle.make} />
            <Row label="Model" value={data.vehicle.model} />
            <Row label="Year" value={String(data.vehicle.year)} />
            {data.vehicle.vin && <Row label="VIN" value={data.vehicle.vin} mono />}
            {data.vehicle.registrationNumber && (
              <Row label="Registration" value={data.vehicle.registrationNumber} />
            )}
            {data.vehicle.odometer != null && (
              <Row label="Odometer" value={`${data.vehicle.odometer.toLocaleString()} km`} />
            )}
          </InfoCard>

          {/* Sale Price */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-center">
            <p className="text-sm text-blue-600 font-medium mb-1">Sale Price</p>
            <p className="text-3xl font-bold text-blue-900">
              AUD ${formatPrice(data.salePrice)}
            </p>
          </div>

          {/* Parties */}
          <InfoCard title="Parties">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Seller</p>
                <p className="text-sm font-medium">{data.vehicle.sellerName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Buyer</p>
                <p className="text-sm font-medium">{data.buyerName}</p>
              </div>
            </div>
          </InfoCard>

          {/* Key Terms */}
          <InfoCard title="Key Terms">
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                You are purchasing this vehicle as inspected
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Full payment required before vehicle release
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Seller warrants they own the vehicle free of debt
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Governed by Victorian law
              </li>
            </ul>
          </InfoCard>

          {/* PPSR */}
          {data.ppsr && (
            <InfoCard title="PPSR Status">
              <div className="flex items-center gap-2">
                {!data.ppsr.isWrittenOff && !data.ppsr.isStolen && !data.ppsr.hasFinance ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Clear — No issues found</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div className="text-sm text-amber-700">
                      {data.ppsr.isWrittenOff && <p>Written off</p>}
                      {data.ppsr.isStolen && <p>Reported stolen</p>}
                      {data.ppsr.hasFinance && <p>Finance recorded</p>}
                    </div>
                  </>
                )}
              </div>
            </InfoCard>
          )}

          <button
            onClick={() => setStep("sign")}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
          >
            I have read the agreement → Proceed to Sign
          </button>
        </div>
      )}

      {/* ═══════ STEP 2: SIGN ═══════ */}
      {step === "sign" && (
        <div className="space-y-5">
          {/* Full terms */}
          <div className="border rounded-lg p-4 max-h-48 overflow-y-auto text-xs text-gray-600 leading-relaxed bg-gray-50">
            <p className="font-semibold text-gray-800 mb-2">SALE AGREEMENT TERMS</p>
            <p className="mb-2">1. The Seller agrees to sell and the Buyer agrees to purchase the above vehicle for AUD ${formatPrice(data.salePrice)}.</p>
            <p className="mb-2">2. The Seller warrants they are the legal owner, the vehicle is free of encumbrances, and the odometer reading is accurate to the best of their knowledge.</p>
            <p className="mb-2">3. The Buyer acknowledges the vehicle is sold as inspected and payment is required in full prior to vehicle release.</p>
            <p className="mb-2">4. Direct Auto Wholesale acts as facilitator only and is not a party to this sale.</p>
            <p>5. This agreement is governed by the laws of Victoria, Australia.</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Legal Name
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Type your full legal name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Signature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Signature</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setUseTypedSig(true)}
                  className={`text-xs px-2.5 py-1 rounded ${useTypedSig ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                >
                  Type
                </button>
                <button
                  onClick={() => setUseTypedSig(false)}
                  className={`text-xs px-2.5 py-1 rounded ${!useTypedSig ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                >
                  Draw
                </button>
              </div>
            </div>

            {useTypedSig ? (
              <div className="border border-gray-300 rounded-lg p-4 bg-white min-h-[80px] flex items-center justify-center">
                {signerName.trim() ? (
                  <p
                    className="text-2xl text-gray-800"
                    style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: "italic" }}
                  >
                    {signerName.trim()}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">Your name will appear here as a signature</p>
                )}
              </div>
            ) : (
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={120}
                  className="w-full border border-gray-300 rounded-lg bg-white cursor-crosshair touch-none"
                  style={{ height: "120px" }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                <button
                  onClick={clearCanvas}
                  className="absolute top-2 right-2 text-xs text-gray-500 bg-white border px-2 py-0.5 rounded hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checks.read}
                onChange={(e) => setChecks({ ...checks, read: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">I have read and understood this agreement</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checks.agree}
                onChange={(e) => setChecks({ ...checks, agree: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                I agree to purchase this vehicle for AUD ${formatPrice(data.salePrice)}
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checks.confirm}
                onChange={(e) => setChecks({ ...checks, confirm: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">I confirm my name above is my legal name</span>
            </label>
          </div>

          {/* Date */}
          <div className="flex justify-between text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2.5">
            <span>Date</span>
            <span className="font-medium">
              {new Date().toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("review")}
              className="px-4 py-3 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleSign}
              disabled={!canSign || submitting}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Sign Agreement
            </button>
          </div>
        </div>
      )}

      {/* ═══════ STEP 3: COMPLETE ═══════ */}
      {step === "complete" && (
        <div className="text-center space-y-6 py-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Agreement Signed Successfully!</h2>
            <p className="text-sm text-gray-500 mt-1">Thank you for completing the signing process.</p>
          </div>

          <div className="bg-gray-50 border rounded-lg p-4 text-left space-y-2 text-sm">
            <Row label="Vehicle" value={`${data.vehicle.year} ${data.vehicle.make} ${data.vehicle.model}`} />
            <Row label="Sale Price" value={`AUD $${formatPrice(data.salePrice)}`} />
            {(data.signerName || signerName) && (
              <Row label="Signed by" value={data.signerName || signerName} />
            )}
            <Row
              label="Date"
              value={
                data.signedAt
                  ? new Date(data.signedAt).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : new Date().toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
              }
            />
            <Row label="Reference" value={data.vehicle.confirmationNumber} mono />
          </div>

          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Signed Agreement (PDF)
            </a>
          )}

          <div className="space-y-3 text-sm text-gray-500">
            <p>
              The Direct Auto Wholesale team will be in touch shortly to arrange
              payment and vehicle handover.
            </p>
            <p>
              Questions? Contact us at{" "}
              <a
                href="mailto:contact@directauto.info"
                className="text-blue-600 underline"
              >
                contact@directauto.info
              </a>
            </p>
          </div>
        </div>
      )}
    </Shell>
  )
}

// ── Utility components ──

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e40af] text-white text-center py-5">
        <h1 className="text-lg font-bold tracking-wide">DIRECT AUTO WHOLESALE</h1>
        <p className="text-xs text-blue-200 mt-0.5">Vehicle Sale Agreement</p>
      </div>
      {/* Content */}
      <div className="max-w-[680px] mx-auto px-4 py-8">{children}</div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-gray-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  )
}
