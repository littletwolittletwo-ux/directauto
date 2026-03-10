"use client"

import { useState } from "react"
import { format } from "date-fns"
import { MessageSquare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface NoteEntry {
  note: string
  userId: string
  userName: string
  createdAt: string
}

interface AdminNotesProps {
  vehicleId: string
  notes: NoteEntry[]
  onNoteAdded: () => void
}

export function AdminNotes({ vehicleId, notes, onNoteAdded }: AdminNotesProps) {
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleAddNote() {
    const trimmed = text.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNotes: [
            ...notes,
            {
              note: trimmed,
              userId: "",
              userName: "",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to add note")
      }

      setText("")
      toast.success("Note added")
      onNoteAdded()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add note"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Internal Notes</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </div>

      {/* Input area */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add an internal note..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[60px] resize-none text-sm"
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
          {submitting ? "Adding..." : "Add Note"}
        </Button>
      </div>

      {/* Notes list */}
      {notes.length > 0 && (
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
      )}
    </div>
  )
}
