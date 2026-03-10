"use client"

import { VehiclesTable } from "@/components/admin/VehiclesTable"

export default function VehiclesListPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">All Vehicles</h1>
      </div>
      <VehiclesTable />
    </div>
  )
}
