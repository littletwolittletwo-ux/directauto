"use client"

import { useState } from "react"
import { SessionProvider } from "next-auth/react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { cn } from "@/lib/utils"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <SessionProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        {/* Main content area - offset by sidebar width on desktop */}
        <div
          className={cn(
            "flex flex-col transition-all duration-300",
            sidebarCollapsed ? "md:pl-[68px]" : "md:pl-[240px]"
          )}
        >
          <Topbar onMobileMenuToggle={() => setMobileOpen(true)} />

          <main className="flex-1 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
