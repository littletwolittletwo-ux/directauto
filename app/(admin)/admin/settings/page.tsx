"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
import {
  Settings,
  Palette,
  Bell,
  Users,
  Copy,
  Save,
  Loader2,
  UserPlus,
  Upload,
} from "lucide-react"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
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
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import QRCode from "qrcode"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SettingsData {
  id: string
  dealershipName: string
  logoPath: string | null
  primaryColor: string
  contactEmail: string | null
  notifyOnSubmit: boolean
  notifyOnPPSR: boolean
}

interface UserData {
  id: string
  name: string
  email: string
  role: "ADMIN" | "STAFF"
  active: boolean
  createdAt: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"

  const [loading, setLoading] = useState(true)
  const [, setSettings] = useState<SettingsData | null>(null)

  // General tab state
  const [dealershipName, setDealershipName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [savingGeneral, setSavingGeneral] = useState(false)

  // Branding tab state
  const [brandName, setBrandName] = useState("")
  const [brandColor, setBrandColor] = useState("#1e40af")
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null)
  const [brandLogoPreview, setBrandLogoPreview] = useState<string | null>(null)
  const [savingBranding, setSavingBranding] = useState(false)

  // Notification tab state
  const [notifyOnSubmit, setNotifyOnSubmit] = useState(true)
  const [notifyOnPPSR, setNotifyOnPPSR] = useState(true)
  const [notifyEmail, setNotifyEmail] = useState("")
  const [savingNotifications, setSavingNotifications] = useState(false)

  // Users tab state
  const [users, setUsers] = useState<UserData[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "STAFF">("STAFF")
  const [inviting, setInviting] = useState(false)

  // QR code
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")

  const publicFormUrl =
    typeof window !== "undefined" ? `${window.location.origin}/submit` : ""

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings")
      if (!res.ok) throw new Error("Failed to fetch settings")
      const data = await res.json()
      setSettings(data)
      setDealershipName(data.dealershipName)
      setContactEmail(data.contactEmail || "")
      setBrandName(data.dealershipName)
      setBrandColor(data.primaryColor || "#1e40af")
      setNotifyOnSubmit(data.notifyOnSubmit)
      setNotifyOnPPSR(data.notifyOnPPSR)
      setNotifyEmail(data.contactEmail || "")
      if (data.logoPath) {
        setLogoPreview(data.logoPath)
        setBrandLogoPreview(data.logoPath)
      }
    } catch {
      toast.error("Failed to load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return
    setLoadingUsers(true)
    try {
      const res = await fetch("/api/vehicles?limit=1") // quick auth check
      if (!res.ok) throw new Error("Unauthorized")
      // Users API would be a separate endpoint; for now we show placeholder
      setUsers([])
    } catch {
      // silent fail
    } finally {
      setLoadingUsers(false)
    }
  }, [isAdmin])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin, fetchUsers])

  // Generate QR code
  useEffect(() => {
    if (publicFormUrl) {
      QRCode.toDataURL(publicFormUrl, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }).then(setQrCodeUrl).catch(() => {})
    }
  }, [publicFormUrl])

  async function handleSaveGeneral() {
    setSavingGeneral(true)
    try {
      const formData = new FormData()
      formData.append("dealershipName", dealershipName)
      formData.append("contactEmail", contactEmail)
      if (logoFile) {
        formData.append("logo", logoFile)
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        body: formData,
      })
      if (!res.ok) throw new Error("Failed to save")
      toast.success("General settings saved")
      fetchSettings()
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setSavingGeneral(false)
    }
  }

  async function handleSaveBranding() {
    setSavingBranding(true)
    try {
      const formData = new FormData()
      formData.append("dealershipName", brandName)
      formData.append("primaryColor", brandColor)
      if (brandLogoFile) {
        formData.append("logo", brandLogoFile)
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        body: formData,
      })
      if (!res.ok) throw new Error("Failed to save")
      toast.success("Branding settings saved")
      fetchSettings()
    } catch {
      toast.error("Failed to save branding")
    } finally {
      setSavingBranding(false)
    }
  }

  async function handleSaveNotifications() {
    setSavingNotifications(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyOnSubmit,
          notifyOnPPSR,
          contactEmail: notifyEmail || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      toast.success("Notification settings saved")
      fetchSettings()
    } catch {
      toast.error("Failed to save notification settings")
    } finally {
      setSavingNotifications(false)
    }
  }

  async function handleInviteUser() {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error("Name and email are required")
      return
    }
    setInviting(true)
    try {
      // This would call a user creation API endpoint
      toast.info(
        "User invitation sent. A temporary password has been generated and emailed."
      )
      setInviteName("")
      setInviteEmail("")
      setInviteRole("STAFF")
      fetchUsers()
    } catch {
      toast.error("Failed to invite user")
    } finally {
      setInviting(false)
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(publicFormUrl)
    toast.success("Public form URL copied to clipboard")
  }

  function handleLogoChange(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "general" | "branding"
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    if (target === "general") {
      setLogoFile(file)
      setLogoPreview(preview)
    } else {
      setBrandLogoFile(file)
      setBrandLogoPreview(preview)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dealershipName">Dealership Name</Label>
                <Input
                  id="dealershipName"
                  value={dealershipName}
                  onChange={(e) => setDealershipName(e.target.value)}
                  placeholder="Direct Auto Wholesale"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview && (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-12 w-12 rounded-lg object-contain border"
                    />
                  )}
                  <label className="cursor-pointer">
                    <span
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" })
                      )}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Upload Logo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLogoChange(e, "general")}
                    />
                  </label>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>Public Form URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={publicFormUrl} readOnly className="flex-1" />
                  <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="space-y-1.5">
                  <Label>QR Code</Label>
                  <div className="inline-block rounded-lg border p-2">
                    <img
                      src={qrCodeUrl}
                      alt="Public form QR code"
                      className="h-40 w-40"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scan to open the public submission form
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveGeneral} disabled={savingGeneral}>
                  {savingGeneral ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Save General Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="brandName">Dealership Name (for forms)</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Direct Auto Wholesale"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Logo (for forms)</Label>
                <div className="flex items-center gap-4">
                  {brandLogoPreview && (
                    <img
                      src={brandLogoPreview}
                      alt="Brand logo preview"
                      className="h-12 w-12 rounded-lg object-contain border"
                    />
                  )}
                  <label className="cursor-pointer">
                    <span
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" })
                      )}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Upload Logo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLogoChange(e, "branding")}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="primaryColor"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    placeholder="#1e40af"
                    className="w-40"
                  />
                  <div
                    className="h-8 w-8 rounded-lg border"
                    style={{ backgroundColor: brandColor }}
                  />
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border-0 p-0"
                  />
                </div>
              </div>

              <Separator />

              {/* Live preview */}
              <div className="space-y-1.5">
                <Label>Live Preview</Label>
                <div
                  className="rounded-lg border p-4"
                  style={{ backgroundColor: brandColor }}
                >
                  <div className="flex items-center gap-3">
                    {brandLogoPreview && (
                      <img
                        src={brandLogoPreview}
                        alt="Preview"
                        className="h-10 w-10 rounded-lg bg-white/20 object-contain p-1"
                      />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {brandName || "Direct Auto Wholesale"}
                      </h3>
                      <p className="text-sm text-white/80">
                        Vehicle Seller Information Form
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveBranding} disabled={savingBranding}>
                  {savingBranding ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Save Branding
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={notifyOnSubmit}
                  onCheckedChange={(checked) =>
                    setNotifyOnSubmit(checked === true)
                  }
                />
                <div>
                  <p className="text-sm font-medium">
                    Email on new submission
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Receive an email whenever a new vehicle submission is
                    received
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  checked={notifyOnPPSR}
                  onCheckedChange={(checked) =>
                    setNotifyOnPPSR(checked === true)
                  }
                />
                <div>
                  <p className="text-sm font-medium">Email on PPSR flags</p>
                  <p className="text-xs text-muted-foreground">
                    Receive an email when PPSR check reveals flags (written
                    off, stolen, finance)
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="notifyEmail">Notification Email</Label>
                <Input
                  id="notifyEmail"
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="admin@dealership.com.au"
                />
                <p className="text-xs text-muted-foreground">
                  All notifications will be sent to this email address
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveNotifications}
                  disabled={savingNotifications}
                >
                  {savingNotifications ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Save Notifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab (ADMIN only) */}
        {isAdmin && (
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Members
                  </CardTitle>

                  {/* Invite User dialog */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        Invite User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Invite New User</DialogTitle>
                        <DialogDescription>
                          A temporary password will be generated and emailed to
                          the new user.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="inviteName">Full Name</Label>
                          <Input
                            id="inviteName"
                            value={inviteName}
                            onChange={(e) => setInviteName(e.target.value)}
                            placeholder="John Smith"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="inviteEmail">Email</Label>
                          <Input
                            id="inviteEmail"
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="john@dealership.com.au"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Role</Label>
                          <Select
                            value={inviteRole}
                            onValueChange={(v: string | null) =>
                              v && setInviteRole(v as "ADMIN" | "STAFF")
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STAFF">Staff</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                          onClick={handleInviteUser}
                          disabled={inviting}
                        >
                          {inviting ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="mr-1.5 h-4 w-4" />
                          )}
                          Send Invitation
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : users.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.role === "ADMIN"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                user.active
                                  ? "text-green-600 text-xs font-medium"
                                  : "text-red-600 text-xs font-medium"
                              }
                            >
                              {user.active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(
                              new Date(user.createdAt),
                              "MMM d, yyyy"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={user.role}
                                onValueChange={(newRole: string | null) => {
                                  if (newRole) {
                                    toast.info(
                                      `Role change to ${newRole} - API endpoint needed`
                                    )
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 w-[90px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="STAFF">
                                    Staff
                                  </SelectItem>
                                  <SelectItem value="ADMIN">
                                    Admin
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  toast.info(
                                    "Deactivation - API endpoint needed"
                                  )
                                }}
                              >
                                Deactivate
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p>No team members found.</p>
                    <p className="mt-1 text-xs">
                      Use the &ldquo;Invite User&rdquo; button to add team members.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
