"use client"

import { useRouter } from "next/navigation"
import { Eye, Check, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function VehicleActionCell({ id, status }: { id: string; status: string }) {
  const router = useRouter()

  async function handleApprove() {
    try {
      const res = await fetch(`/api/vehicles/${id}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      toast.success("Vehicle approved")
      router.refresh()
    } catch {
      toast.error("Failed to approve vehicle")
    }
  }

  async function handleReject() {
    const reason = prompt("Enter rejection reason:")
    if (!reason) return
    try {
      const res = await fetch(`/api/vehicles/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Vehicle rejected")
      router.refresh()
    } catch {
      toast.error("Failed to reject vehicle")
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.push(`/admin/vehicles/${id}`)}
        title="View"
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-green-600 hover:text-green-700"
        onClick={handleApprove}
        title="Approve"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-red-600 hover:text-red-700"
        onClick={handleReject}
        title="Reject"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      {status === "APPROVED" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.open(`/api/vehicles/${id}/bill-of-sale-doc/download`, "_blank")}
          title="Bill of Sale"
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
