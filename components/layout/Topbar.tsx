"use client"

import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Menu, LogOut, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const breadcrumbMap: Record<string, string> = {
  admin: "Dashboard",
  vehicles: "Vehicles",
  documents: "Documents",
  audit: "Audit Log",
  settings: "Settings",
  new: "New",
}

function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  const crumbs: { label: string; href: string }[] = []

  let currentPath = ""
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label =
      breadcrumbMap[segment] ||
      (segment.match(/^[0-9a-f-]+$/i) ? "Details" : segment)
    crumbs.push({ label, href: currentPath })
  }

  return crumbs
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function Topbar({
  onMobileMenuToggle,
}: {
  onMobileMenuToggle: () => void
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const breadcrumbs = generateBreadcrumbs(pathname)

  const userName = session?.user?.name || "User"
  const userRole = session?.user?.role || "STAFF"
  const userEmail = session?.user?.email || ""

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-white px-4 lg:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span
              className={
                index === breadcrumbs.length - 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          suppressHydrationWarning
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-[#1e40af] text-[10px] text-white">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline-block">
            {userName}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1 py-1">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
              <Badge
                variant={userRole === "ADMIN" ? "default" : "secondary"}
                className="mt-1 w-fit"
              >
                {userRole}
              </Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onSelect={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
