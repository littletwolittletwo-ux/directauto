"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface DailyData {
  date: string
  count: number
}

interface StatusData {
  status: string
  count: number
  color: string
}

interface RiskTrendData {
  date: string
  avgScore: number
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: "Pending",
  DOCUMENTS_MISSING: "Docs Missing",
  RISK_FLAGGED: "Flagged",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}

export function SubmissionsBarChart({ dailyData }: { dailyData: DailyData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions Per Day</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: string) => {
                  const d = new Date(val)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
                labelFormatter={(label: any) =>
                  new Date(String(label)).toLocaleDateString("en-AU", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Submissions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatusPieChart({ statusData }: { statusData: StatusData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
                paddingAngle={2}
                label={(props: any) => {
                  const { status, count } = props as { status: string; count: number }
                  return count > 0 ? `${STATUS_LABELS[status] || status}: ${count}` : ""
                }}
                labelLine={false}
              >
                {statusData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
                formatter={(value: any, name: any) => [
                  value,
                  STATUS_LABELS[String(name)] || String(name),
                ]}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs">
                    {STATUS_LABELS[value] || value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function RiskTrendChart({ riskTrend }: { riskTrend: RiskTrendData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Score Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={riskTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: string) => {
                  const d = new Date(val)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
                labelFormatter={(label: any) =>
                  new Date(String(label)).toLocaleDateString("en-AU", {
                    month: "short",
                    day: "numeric",
                  })
                }
                formatter={(value: any) => [Number(value).toFixed(1), "Avg Risk Score"]}
              />
              <Line
                type="monotone"
                dataKey="avgScore"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name="Avg Risk Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
