"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  Loader2,
  DollarSign,
} from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ExpensesPanelProps {
  vehicleId: string
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ExpensesPanel({ vehicleId }: ExpensesPanelProps) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [margin, setMargin] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Add/Edit dialog
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formCategoryId, setFormCategoryId] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [formSupplier, setFormSupplier] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [expRes, catRes, marginRes] = await Promise.all([
        fetch(`/api/vehicles/${vehicleId}/expenses`),
        fetch(`/api/expense-categories`),
        fetch(`/api/vehicles/${vehicleId}/expenses/margin`),
      ])

      if (expRes.ok) setExpenses(await expRes.json())
      if (catRes.ok) setCategories(await catRes.json())
      if (marginRes.ok) setMargin(await marginRes.json())
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function openAddDialog() {
    setEditingId(null)
    setFormCategoryId("")
    setFormAmount("")
    setFormDate(format(new Date(), "yyyy-MM-dd"))
    setFormSupplier("")
    setFormNotes("")
    setShowDialog(true)
  }

  function openEditDialog(expense: any) {
    setEditingId(expense.id)
    setFormCategoryId(expense.categoryId)
    setFormAmount(String(expense.amountCents / 100))
    setFormDate(format(new Date(expense.expenseDate), "yyyy-MM-dd"))
    setFormSupplier(expense.supplier || "")
    setFormNotes(expense.notes || "")
    setShowDialog(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const amountCents = Math.round(parseFloat(formAmount) * 100)
      if (isNaN(amountCents) || amountCents <= 0) {
        toast.error("Please enter a valid amount")
        return
      }

      const body = {
        categoryId: formCategoryId,
        amountCents,
        expenseDate: formDate,
        supplier: formSupplier || undefined,
        notes: formNotes || undefined,
      }

      const url = editingId
        ? `/api/vehicles/${vehicleId}/expenses/${editingId}`
        : `/api/vehicles/${vehicleId}/expenses`

      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }

      toast.success(editingId ? "Expense updated" : "Expense added")
      setShowDialog(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(expenseId: string) {
    if (!confirm("Delete this expense?")) return
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/expenses/${expenseId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success("Expense deleted")
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
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

  const activeCategories = categories.filter((c: any) => c.isActive)

  return (
    <>
      {/* Margin Summary */}
      {margin && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-lg font-bold">{formatCents(margin.totalCostCents)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sale Price</p>
                <p className="text-lg font-bold">
                  {margin.salePriceCents !== null ? formatCents(margin.salePriceCents) : "Pending"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross Margin</p>
                <p
                  className={`text-lg font-bold ${
                    margin.grossMarginCents !== null
                      ? margin.grossMarginCents >= 0
                        ? "text-green-600"
                        : "text-red-600"
                      : ""
                  }`}
                >
                  {margin.grossMarginCents !== null
                    ? `${formatCents(margin.grossMarginCents)} (${margin.grossMarginPercent}%)`
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Expenses ({expenses.length})</CardTitle>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Expense
          </Button>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No expenses recorded yet
            </p>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp: any) => {
                const isLocked = exp.source !== "manual"

                return (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {exp.category?.name || "—"}
                        </p>
                        {isLocked && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                Auto-generated ({exp.source}) — cannot be edited
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(exp.expenseDate), "MMM d, yyyy")}
                        {exp.supplier && ` · ${exp.supplier}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{formatCents(exp.amountCents)}</p>
                      {!isLocked && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(exp)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={() => handleDelete(exp.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Supplier (optional)</Label>
              <Input
                value={formSupplier}
                onChange={(e) => setFormSupplier(e.target.value)}
                placeholder="e.g. RACV Inspection"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving || !formCategoryId || !formAmount}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {editingId ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
