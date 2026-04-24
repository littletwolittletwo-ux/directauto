"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import {
  Plus,
  Send,
  Download,
  Loader2,
  FileText,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface InvoicesPanelProps {
  vehicleId: string
  isApproved: boolean
  vehicle: {
    sellerName: string
    sellerEmail: string
    purchasePrice: number | null
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function InvoicesPanel({ vehicleId, isApproved, vehicle }: InvoicesPanelProps) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Generate invoice dialog
  const [showGenerate, setShowGenerate] = useState(false)
  const [salePrice, setSalePrice] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [buyerAddress, setBuyerAddress] = useState("")
  const [generating, setGenerating] = useState(false)

  // Send dialog
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null)
  const [sendEmail, setSendEmail] = useState("")
  const [sending, setSending] = useState(false)

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/invoices`)
      if (res.ok) setInvoices(await res.json())
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  function openGenerateDialog() {
    setSalePrice(vehicle.purchasePrice?.toString() || "")
    setBuyerName(vehicle.sellerName || "")
    setBuyerEmail(vehicle.sellerEmail || "")
    setBuyerAddress("")
    setShowGenerate(true)
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salePrice: parseFloat(salePrice),
          buyerName,
          buyerEmail,
          buyerAddress: buyerAddress || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to generate invoice")
      }
      toast.success("Invoice generated successfully")
      setShowGenerate(false)
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSend() {
    if (!sendingInvoiceId) return
    setSending(true)
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/invoices/${sendingInvoiceId}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toEmail: sendEmail }),
        }
      )
      if (!res.ok) throw new Error("Failed to send")
      toast.success("Invoice sent")
      setSendingInvoiceId(null)
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Invoices ({invoices.length})</CardTitle>
          {isApproved ? (
            <Button size="sm" onClick={openGenerateDialog}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Generate Invoice
            </Button>
          ) : (
            <Button size="sm" disabled title="Approval required to generate invoices">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Generate Invoice
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No invoices generated yet
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {inv.buyerName} &middot;{" "}
                      {format(new Date(inv.createdAt), "MMM d, yyyy")}
                      {inv.sentAt && (
                        <span className="text-green-600">
                          {" "}
                          &middot; Sent {format(new Date(inv.sentAt), "MMM d")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{formatCents(inv.totalCents)}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setSendingInvoiceId(inv.id)
                        setSendEmail(inv.buyerEmail)
                      }}
                      title="Send invoice"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Invoice Dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
            <DialogDescription>
              Create a sale invoice for this vehicle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sale Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div>
              <Label>Buyer Name</Label>
              <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </div>
            <div>
              <Label>Buyer Email</Label>
              <Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
            </div>
            <div>
              <Label>Buyer Address (optional)</Label>
              <Input value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} />
            </div>
            {salePrice && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p>
                  Subtotal: ${parseFloat(salePrice || "0").toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </p>
                <p>
                  GST (10%): ${(parseFloat(salePrice || "0") * 0.1).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </p>
                <p className="font-medium">
                  Total: ${(parseFloat(salePrice || "0") * 1.1).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleGenerate}
              disabled={generating || !salePrice || !buyerName || !buyerEmail}
            >
              {generating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Generate Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Invoice Dialog */}
      <Dialog
        open={!!sendingInvoiceId}
        onOpenChange={() => setSendingInvoiceId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Send to email</Label>
            <Input
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSend} disabled={sending || !sendEmail}>
              {sending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              <Send className="mr-1.5 h-4 w-4" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
