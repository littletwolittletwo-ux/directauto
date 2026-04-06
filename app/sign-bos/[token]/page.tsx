"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, Loader2, AlertTriangle, FileText, Download } from "lucide-react"

interface BillOfSaleData {
  status: string
  // Seller
  sellerFullName: string
  sellerAddress: string | null
  sellerSuburb: string | null
  sellerState: string | null
  sellerPostcode: string | null
  sellerPhone: string
  sellerEmail: string
  sellerLicenceNumber: string | null
  sellerDob: string | null
  sellerCustomerId: string | null
  // Vehicle
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
  // Sale
  purchasePrice: number
  depositPaid: number
  balanceDue: number
  paymentMethod: string | null
  dateOfSale: string
  // Condition
  knownDefects: string | null
  // Meta
  confirmationNumber: string
  // Signed data
  signerName?: string
  signedAt?: string
}

type Step = "review" | "sign" | "complete"

export default function BillOfSaleSigningPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<BillOfSaleData | null>(null)
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
      const res = await fetch(`/api/bill-of-sale/${token}`)
      if (!res.ok) {
        if (res.status === 404 || res.status === 410) {
          const body = await res.json()
          setError(body.error || "This signing link is invalid or has expired.")
        } else {
          setError("Failed to load document.")
        }
        return
      }
      const d = await res.json()
      setData(d)
      if (d.status === "SIGNED") {
        setStep("complete")
        setPdfUrl(`/api/bill-of-sale/${token}/pdf`)
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

  // Canvas setup for retina displays
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext("2d")
    if (ctx) ctx.scale(dpr, dpr)
  }, [useTypedSig])

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if ("touches" in e) e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    setIsDrawing(true)
    setHasDrawn(true)
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    if ("touches" in e) e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#1e293b"
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function endDraw() { setIsDrawing(false) }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    setHasDrawn(false)
  }

  function getSignatureData(): string | null {
    if (useTypedSig) return null
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return null
    return canvas.toDataURL("image/png")
  }

  async function handleSign() {
    if (!data) return
    setSubmitError("")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bill-of-sale/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signatureData: getSignatureData(),
        }),
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
      setPdfUrl(result.pdfUrl || `/api/bill-of-sale/${token}/pdf`)
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

  // ── Error ──
  if (error || !data) {
    return (
      <Shell>
        <div className="text-center py-16 space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-900">Link Invalid</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">{error || "This signing link is not valid."}</p>
          <p className="text-gray-400 text-xs">Contact Direct Auto if you need assistance.</p>
        </div>
      </Shell>
    )
  }

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
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${i <= stepIdx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
              {i < stepIdx ? "\u2713" : i + 1}
            </div>
            <span className={`text-xs font-medium ${i <= stepIdx ? "text-blue-600" : "text-gray-400"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < stepIdx ? "bg-blue-600" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: REVIEW ═══ */}
      {step === "review" && (
        <div className="space-y-4">
          {/* Sale Price */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-center">
            <p className="text-sm text-blue-600 font-medium mb-1">Purchase Price</p>
            <p className="text-3xl font-bold text-blue-900">AUD ${formatPrice(data.purchasePrice)}</p>
          </div>

          {/* Seller Details */}
          <InfoCard title="Seller Details">
            <Row label="Name" value={data.sellerFullName} />
            {data.sellerAddress && <Row label="Address" value={data.sellerAddress} />}
            {data.sellerSuburb && <Row label="Suburb" value={data.sellerSuburb} />}
            {data.sellerState && <Row label="State" value={`${data.sellerState} ${data.sellerPostcode || ""}`} />}
            <Row label="Phone" value={data.sellerPhone} />
            <Row label="Email" value={data.sellerEmail} />
          </InfoCard>

          {/* Buyer Details (static) */}
          <InfoCard title="Buyer Details">
            <Row label="Business" value="Stateline Holdings Pty Ltd TA Direct Auto" />
            <Row label="ABN" value="69 695 170 453" />
            <Row label="LMCT" value="0013130" />
            <Row label="Address" value="697 Burke Road, Camberwell VIC 3124" />
            <Row label="Contact" value="Vikram McGinty — Lead Sales" />
          </InfoCard>

          {/* Vehicle Details */}
          <InfoCard title="Vehicle Details">
            <Row label="Registration" value={data.registrationNumber} />
            {data.stateOfRegistration && <Row label="State of Rego" value={data.stateOfRegistration} />}
            <Row label="VIN" value={data.vinNumber} mono />
            {data.engineNumber && <Row label="Engine No." value={data.engineNumber} />}
            <Row label="Year" value={String(data.yearOfManufacture)} />
            <Row label="Make" value={data.vehicleMake} />
            <Row label="Model" value={data.vehicleModel} />
            {data.vehicleVariant && <Row label="Variant" value={data.vehicleVariant} />}
            {data.bodyType && <Row label="Body Type" value={data.bodyType} />}
            {data.colour && <Row label="Colour" value={data.colour} />}
            {data.fuelType && <Row label="Fuel" value={data.fuelType} />}
            {data.transmission && <Row label="Transmission" value={data.transmission} />}
            <Row label="Odometer" value={`${data.odometerReading.toLocaleString()} km`} />
            {data.numberOfKeys && <Row label="Keys" value={data.numberOfKeys} />}
          </InfoCard>

          {/* Sale Details */}
          <InfoCard title="Sale Details">
            <Row label="Purchase Price" value={`AUD $${formatPrice(data.purchasePrice)}`} />
            <Row label="Deposit Paid" value={`AUD $${formatPrice(data.depositPaid)}`} />
            <Row label="Balance Due" value={`AUD $${formatPrice(data.balanceDue)}`} />
            {data.paymentMethod && <Row label="Payment Method" value={data.paymentMethod} />}
            <Row label="Date of Sale" value={new Date(data.dateOfSale).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })} />
          </InfoCard>

          {/* Condition */}
          {data.knownDefects && (
            <InfoCard title="Known Defects / Conditions">
              <p className="text-sm text-gray-700">{data.knownDefects}</p>
            </InfoCard>
          )}

          <button
            onClick={() => setStep("sign")}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
          >
            I have reviewed the Bill of Sale &rarr; Proceed to Sign
          </button>
        </div>
      )}

      {/* ═══ STEP 2: SIGN ═══ */}
      {step === "sign" && (
        <div className="space-y-5">
          {/* Terms */}
          <div className="border rounded-lg p-4 max-h-48 overflow-y-auto text-xs text-gray-600 leading-relaxed bg-gray-50">
            <p className="font-semibold text-gray-800 mb-2">TERMS AND CONDITIONS</p>
            <p className="mb-1.5">The Seller hereby represents and warrants to the Buyer:</p>
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>There are no legal restrictions preventing the Seller from entering into this Bill of Sale Agreement.</li>
              <li>The Seller is the sole legal and beneficial owner of the vehicle.</li>
              <li>The vehicle is free of any encumbrances or adverse claims.</li>
              <li>The Seller will provide all required documents to transfer title free of encumbrances.</li>
              <li>The Seller indemnifies the Buyer against all claims relating to ownership of the vehicle.</li>
              <li>Title does not pass until cleared funds are received.</li>
              <li>The purchase price of AUD ${formatPrice(data.purchasePrice)} is the full and final amount, all inclusive.</li>
              <li>All information provided is true and correct to the best of the Seller&apos;s knowledge.</li>
              <li>This agreement is governed by the laws of the State of Victoria, Australia.</li>
            </ol>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Legal Name</label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Type your full legal name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Signature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Signature</label>
              <div className="flex gap-1">
                <button onClick={() => setUseTypedSig(true)} className={`text-xs px-2.5 py-1 rounded ${useTypedSig ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>Type</button>
                <button onClick={() => setUseTypedSig(false)} className={`text-xs px-2.5 py-1 rounded ${!useTypedSig ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>Draw</button>
              </div>
            </div>
            {useTypedSig ? (
              <div className="border border-gray-300 rounded-lg p-4 bg-white min-h-[80px] flex items-center justify-center">
                {signerName.trim() ? (
                  <p className="text-2xl text-gray-800" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: "italic" }}>{signerName.trim()}</p>
                ) : (
                  <p className="text-sm text-gray-400">Your name will appear here as a signature</p>
                )}
              </div>
            ) : (
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  className="w-full border border-gray-300 rounded-lg bg-white cursor-crosshair"
                  style={{ height: "120px", touchAction: "none" }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
                />
                <button onClick={clearCanvas} className="absolute top-2 right-2 text-xs text-gray-500 bg-white border px-2 py-0.5 rounded hover:bg-gray-50">Clear</button>
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.read} onChange={(e) => setChecks({ ...checks, read: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">I have read and understood this Bill of Sale and its terms and conditions</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.agree} onChange={(e) => setChecks({ ...checks, agree: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">I agree to sell my vehicle for AUD ${formatPrice(data.purchasePrice)}</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.confirm} onChange={(e) => setChecks({ ...checks, confirm: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">I confirm I am <strong>{data.sellerFullName}</strong> and the information above is true and correct</span>
            </label>
          </div>

          {/* Date */}
          <div className="flex justify-between text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2.5">
            <span>Date</span>
            <span className="font-medium">
              {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" })}
            </span>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{submitError}</div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep("review")} className="px-4 py-3 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50">Back</button>
            <button
              onClick={handleSign}
              disabled={!canSign || submitting}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Sign Bill of Sale
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: COMPLETE ═══ */}
      {step === "complete" && (
        <div className="text-center space-y-6 py-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bill of Sale Signed Successfully!</h2>
            <p className="text-sm text-gray-500 mt-1">Thank you for completing the signing process.</p>
          </div>

          <div className="bg-gray-50 border rounded-lg p-4 text-left space-y-2 text-sm">
            <Row label="Vehicle" value={`${data.yearOfManufacture} ${data.vehicleMake} ${data.vehicleModel}`} />
            <Row label="Purchase Price" value={`AUD $${formatPrice(data.purchasePrice)}`} />
            {(data.signerName || signerName) && <Row label="Signed by" value={data.signerName || signerName} />}
            <Row
              label="Date"
              value={
                data.signedAt
                  ? new Date(data.signedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
                  : new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
              }
            />
            <Row label="Reference" value={data.confirmationNumber} mono />
          </div>

          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors">
              <Download className="h-4 w-4" />
              Download Signed Bill of Sale (PDF)
            </a>
          )}

          <div className="space-y-3 text-sm text-gray-500">
            <p>A confirmation email with the signed document has been sent to your email address.</p>
            <p>The Direct Auto team will be in touch to arrange payment and vehicle handover.</p>
            <p>Questions? Contact us at{" "}
              <a href="mailto:contact@directauto.info" className="text-blue-600 underline">contact@directauto.info</a>
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
    <div className="min-h-screen-safe bg-gray-50">
      <div className="bg-[#1e40af] text-white text-center py-5">
        <h1 className="text-lg font-bold tracking-wide">DIRECT AUTO</h1>
        <p className="text-xs text-blue-200 mt-0.5">Vehicle Bill of Sale</p>
      </div>
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
      <span className={`font-medium text-gray-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}
