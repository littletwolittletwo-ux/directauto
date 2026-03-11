"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle2 } from "lucide-react"

interface AgreementData {
  id: string
  sellerName: string
  sellerEmail: string
  sellerPhone: string
  vin: string
  registrationNumber: string
  make: string
  model: string
  year: number
  odometer: number
  purchasePrice: number
  saleAgreementStatus: string
  identity: {
    fullLegalName: string
    address: string
    driversLicenceNumber: string
    licenceState: string
  } | null
}

export default function SaleAgreementPage() {
  const params = useParams()
  const token = params.token as string
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<any>(null)

  const [data, setData] = useState<AgreementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [hasSig, setHasSig] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sale-agreement/${token}`)
      if (!res.ok) {
        const json = await res.json()
        if (json.signed) {
          setAlreadySigned(true)
          return
        }
        throw new Error(json.error || "Failed to load agreement")
      }
      setData(await res.json())
    } catch (err: any) {
      setError(err.message || "Failed to load agreement")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Initialize signature pad after data loads
  useEffect(() => {
    if (!data || !canvasRef.current) return

    let SignaturePad: any
    import("signature_pad").then((mod) => {
      SignaturePad = mod.default
      const canvas = canvasRef.current!
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext("2d")!
      ctx.scale(ratio, ratio)

      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      })

      signaturePadRef.current.addEventListener("endStroke", () => {
        setHasSig(!signaturePadRef.current.isEmpty())
      })
    })

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off()
      }
    }
  }, [data])

  function clearSignature() {
    signaturePadRef.current?.clear()
    setHasSig(false)
  }

  async function handleSign() {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) return
    setSigning(true)
    try {
      const signatureDataUrl = signaturePadRef.current.toDataURL()
      const res = await fetch(`/api/sale-agreement/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signatureDataUrl }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Failed to sign agreement")
      }
      setSigned(true)
    } catch (err: any) {
      setError(err.message || "Failed to sign agreement")
    } finally {
      setSigning(false)
    }
  }

  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (alreadySigned) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-xl font-semibold">Agreement Already Signed</h2>
            <p className="text-muted-foreground text-sm">
              This sale agreement has already been signed. No further action is needed.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <h2 className="text-xl font-semibold text-red-600">Error</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (signed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-xl font-semibold">Agreement Signed</h2>
            <p className="text-muted-foreground text-sm">
              Thank you! Your sale agreement has been signed successfully. Direct Auto Wholesale will be in touch shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const sellerFullName = data.identity?.fullLegalName || data.sellerName
  const sellerAddress = data.identity?.address || "—"
  const sellerLicence = data.identity?.driversLicenceNumber
    ? `${data.identity.driversLicenceNumber} (${data.identity.licenceState})`
    : "—"

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Direct Auto Wholesale
          </h1>
          <p className="text-gray-500 text-sm mt-1">Vehicle Sale Agreement</p>
        </div>

        {/* Agreement Document */}
        <Card className="mb-6">
          <CardContent className="p-8 space-y-6 text-sm leading-relaxed text-gray-700">
            {/* Title */}
            <div className="text-center border-b pb-4">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                Vehicle Sale Agreement
              </h2>
              <p className="text-gray-500 mt-1">Date: {today}</p>
            </div>

            {/* Parties */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">1. Parties</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-semibold text-gray-900">Seller</p>
                  <p><span className="text-gray-500">Name:</span> {sellerFullName}</p>
                  <p><span className="text-gray-500">Address:</span> {sellerAddress}</p>
                  <p><span className="text-gray-500">Licence:</span> {sellerLicence}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-semibold text-gray-900">Buyer</p>
                  <p>Direct Auto Wholesale</p>
                  <p>697 Burke Road</p>
                  <p>Camberwell VIC 3124</p>
                </div>
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">2. Vehicle Details</h3>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 bg-gray-50 text-gray-500 w-1/3">Make</td>
                      <td className="px-4 py-2.5 font-medium">{data.make}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 bg-gray-50 text-gray-500">Model</td>
                      <td className="px-4 py-2.5 font-medium">{data.model}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 bg-gray-50 text-gray-500">Year</td>
                      <td className="px-4 py-2.5 font-medium">{data.year}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 bg-gray-50 text-gray-500">VIN</td>
                      <td className="px-4 py-2.5 font-mono font-medium">{data.vin}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2.5 bg-gray-50 text-gray-500">Registration</td>
                      <td className="px-4 py-2.5 font-medium">{data.registrationNumber}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 bg-gray-50 text-gray-500">Odometer</td>
                      <td className="px-4 py-2.5 font-medium">{data.odometer.toLocaleString()} km</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchase Price */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">3. Purchase Price</h3>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
                <p className="text-2xl font-bold text-blue-800">
                  ${data.purchasePrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AUD
                </p>
                <p className="text-blue-600 text-xs mt-1">(inclusive of GST where applicable)</p>
              </div>
            </div>

            {/* Terms */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">4. Terms & Conditions</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>The Seller warrants that they are the legal owner of the vehicle and have the right to sell it.</li>
                <li>The Seller warrants that the vehicle is free from any encumbrances, liens, or security interests unless previously disclosed.</li>
                <li>The Seller agrees to transfer ownership and deliver the vehicle to the Buyer upon receipt of payment.</li>
                <li>The Buyer agrees to pay the Purchase Price as stated above to the Seller.</li>
                <li>The Seller warrants that all information provided regarding the vehicle is true and accurate to the best of their knowledge.</li>
                <li>Both parties agree that this agreement constitutes the entire agreement between them regarding the sale of the vehicle.</li>
                <li>This agreement is governed by the laws of the State of Victoria, Australia.</li>
              </ol>
            </div>

            {/* Signature Section */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-gray-900">5. Seller Signature</h3>
              <p className="text-gray-600">
                By signing below, I, <strong>{sellerFullName}</strong>, agree to sell the above-described vehicle to Direct Auto Wholesale for the stated purchase price and confirm that all details are correct.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Draw your signature below</p>
                  <button
                    onClick={clearSignature}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    className="w-full"
                    style={{ height: 200, touchAction: "none" }}
                  />
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="agree"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                />
                <label htmlFor="agree" className="text-sm text-gray-600 cursor-pointer leading-tight">
                  I agree to the terms above and confirm that I am the legal owner of the vehicle described in this agreement.
                </label>
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-base py-5"
                disabled={!agreed || !hasSig || signing}
                onClick={handleSign}
              >
                {signing ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                )}
                Sign Agreement
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Direct Auto Wholesale &middot; 697 Burke Road, Camberwell VIC 3124
        </p>
      </div>
    </div>
  )
}
