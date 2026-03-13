"use client"

import { useState, useCallback, useEffect } from "react"
import { format } from "date-fns"
import { Send, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface InspectionNote {
  type: string
  note: string
  userId: string
  userName: string
  createdAt: string
}

interface InspectionNotesProps {
  vehicleId: string
}

export function InspectionNotes({ vehicleId }: InspectionNotesProps) {
  const [notes, setNotes] = useState<InspectionNote[]>([])
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/inspection-notes`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data.notes || [])
      }
    } catch {
      console.error("Failed to fetch inspection notes")
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  async function handleAddNote() {
    const trimmed = text.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/inspection-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to add note")
      }

      const data = await res.json()
      setNotes(data.notes || [])
      setText("")
      toast.success("Inspection note added")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add note"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Inspection Notes (internal)</h3>
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Record condition, issues found, recommended actions..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[80px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleAddNote()
            }
          }}
        />
        <Button
          size="sm"
          onClick={handleAddNote}
          disabled={!text.trim() || submitting}
          className="w-full"
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {submitting ? "Saving..." : "Save Note"}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading notes...</p>
      ) : notes.length > 0 ? (
        <div className="max-h-[300px] space-y-2 overflow-y-auto">
          {[...notes].reverse().map((entry, idx) => (
            <div
              key={idx}
              className="rounded-lg border bg-muted/30 p-2.5 text-sm"
            >
              <p className="whitespace-pre-wrap break-words text-foreground">
                {entry.note}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                {entry.userName && <span>{entry.userName}</span>}
                {entry.userName && entry.createdAt && (
                  <span className="text-muted-foreground/50">|</span>
                )}
                {entry.createdAt && (
                  <span>
                    {format(
                      new Date(entry.createdAt),
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No inspection notes yet.</p>
      )}
    </div>
  )
}
