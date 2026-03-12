"use client"

import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function CopyLinkButton() {
  async function handleCopy() {
    const url = `${window.location.origin}/submit`
    await navigator.clipboard.writeText(url)
    toast.success("Public form link copied to clipboard")
  }

  return (
    <Button variant="outline" className="w-full justify-start" onClick={handleCopy}>
      <Copy className="mr-2 h-4 w-4" />
      Copy Public Form Link
    </Button>
  )
}
