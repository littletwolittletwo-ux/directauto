"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Car,
  FileText,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  SearchCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Acquire Vehicle", href: "/admin/acquire", icon: SearchCheck },
  { label: "Vehicles", href: "/admin/vehicles", icon: Car },
  { label: "Documents", href: "/admin/documents", icon: FileText },
  { label: "Audit Log", href: "/admin/audit", icon: Clock },
  { label: "Settings", href: "/admin/settings", icon: Settings, adminOnly: true },
]

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-white/15 text-white"
          : "text-blue-200 hover:bg-white/10 hover:text-white",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><div>{link}</div></TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function MobileNavLink({
  item,
  isActive,
  onClose,
}: {
  item: NavItem
  isActive: boolean
  onClose: () => void
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-white/15 text-white"
          : "text-blue-200 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  )
}

export function Sidebar({
  mobileOpen,
  onMobileOpenChange,
  collapsed,
  onCollapsedChange,
}: {
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const userRole = session?.user?.role

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || userRole === "ADMIN"
  )

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin"
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <TooltipProvider>
        <aside
          className={cn(
            "hidden md:flex flex-col fixed inset-y-0 left-0 z-30 border-r border-blue-900 bg-[#1e40af] transition-all duration-300",
            collapsed ? "w-[68px]" : "w-[240px]"
          )}
        >
          {/* Logo / brand */}
          <div
            className={cn(
              "flex h-16 items-center border-b border-blue-900 px-4",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            {collapsed ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 font-bold text-white text-xs">
                DA
              </div>
            ) : (
              <Image src="/logo.png" alt="Direct Auto Wholesale" width={140} height={50} className="object-contain" />
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {filteredItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                collapsed={collapsed}
              />
            ))}
          </nav>

          {/* Collapse toggle */}
          <div className="border-t border-blue-900 p-3">
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-blue-200 hover:bg-white/10 hover:text-white"
              onClick={() => onCollapsedChange(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </aside>
      </TooltipProvider>

      {/* Mobile sidebar (sheet overlay) */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[280px] border-r-0 bg-[#1e40af] p-0 text-white [&>button]:hidden"
        >
          <SheetHeader className="border-b border-blue-900 px-4">
            <SheetTitle className="flex items-center gap-3 text-white">
              <Image src="/logo.png" alt="Direct Auto Wholesale" width={140} height={50} className="object-contain" />
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {filteredItems.map((item) => (
              <MobileNavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                onClose={() => onMobileOpenChange(false)}
              />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
