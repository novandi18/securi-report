"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  getDashboardStatsAction,
  type DashboardStats,
} from "@/lib/actions/dashboard";
import { getSeverityColor } from "@/lib/cvss4";
import type { SeverityLabel } from "@/lib/cvss4";
import {
  FileText,
  ShieldAlert,
  AlertTriangle,
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

// ─── Severity hex colors ─────────────────────────────────

const SEV_HEX: Record<SeverityLabel, string> = {
  None: "#6B7280",
  Low: "#3B82F6",
  Medium: "#EAB308",
  High: "#F97316",
  Critical: "#EF4444",
};

// ─── Types ───────────────────────────────────────────────

interface DashboardClientProps {
  customers: { id: string; name: string }[];
  initialCustomerId?: string;
}

// ─── Skeleton Block ──────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gray-200/60 dark:bg-white/5 ${className}`}
    />
  );
}

// ─── Bento Card wrapper ──────────────────────────────────

function BentoCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200/60 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1C2434] ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export default function DashboardClient({
  customers: initialCustomers,
  initialCustomerId,
}: DashboardClientProps) {
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Recent Activity filters + pagination
  const ACTIVITY_PAGE_SIZE = 8;
  const [activityPage, setActivityPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");

  const filteredReports = useMemo(() => {
    if (!stats) return [];
    return stats.recentReports.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (severityFilter && r.severity !== severityFilter) return false;
      return true;
    });
  }, [stats, statusFilter, severityFilter]);

  const activityTotalPages = Math.max(1, Math.ceil(filteredReports.length / ACTIVITY_PAGE_SIZE));
  const paginatedReports = useMemo(
    () => filteredReports.slice((activityPage - 1) * ACTIVITY_PAGE_SIZE, activityPage * ACTIVITY_PAGE_SIZE),
    [filteredReports, activityPage],
  );

  // Reset page when filters change
  useEffect(() => {
    setActivityPage(1);
  }, [statusFilter, severityFilter]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const res = await getDashboardStatsAction(customerId || undefined);
    if (res.success && res.data) setStats(res.data);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Derived chart data ──
  const sevLabels = useMemo(
    () =>
      stats
        ? (Object.keys(stats.severityDistribution) as SeverityLabel[]).filter(
            (l) => stats.severityDistribution[l] > 0,
          )
        : [],
    [stats],
  );

  // ── Skeleton state ──
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-5">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-dark dark:text-white">
          Dashboard Overview
        </h2>
        {initialCustomers.length > 0 && (
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border border-stroke bg-white px-4 py-2 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary sm:w-64"
          >
            <option value="">All Clients</option>
            {initialCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ═══ TOP ROW — 4 Mini-Cards ═══ */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MiniCard
          label="Total Reports"
          value={stats.totalReports}
          icon={<FileText size={20} />}
          accent="from-indigo-500 to-purple-600"
        />
        <MiniCard
          label="Open Findings"
          value={stats.openFindings}
          icon={<ShieldAlert size={20} />}
          accent="from-blue-500 to-cyan-500"
        />
        <MiniCard
          label="Critical Alerts"
          value={stats.criticalAlerts}
          icon={<AlertTriangle size={20} />}
          accent="from-red-500 to-rose-600"
        />
        <MiniCard
          label="Avg CVSS"
          value={stats.averageCvss}
          icon={<Activity size={20} />}
          accent="from-amber-500 to-orange-500"
          isFloat
        />
      </div>

      {/* ═══ MIDDLE ROW — Severity Distribution + Risk Score Trend ═══ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Severity Distribution (Pie) */}
        <BentoCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
            Severity Distribution
          </h3>
          {sevLabels.length === 0 ? (
            <p className="flex h-64 items-center justify-center text-sm text-dark-4 dark:text-dark-6">
              No CVSS data available
            </p>
          ) : (
            <ReactECharts
              style={{ height: 300 }}
              option={{
                tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
                legend: {
                  bottom: 0,
                  textStyle: { color: "#94A3B8", fontSize: 12 },
                },
                series: [
                  {
                    type: "pie",
                    radius: ["40%", "70%"],
                    avoidLabelOverlap: true,
                    itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: "transparent" },
                    label: { show: false },
                    emphasis: {
                      label: { show: true, fontWeight: "bold", fontSize: 14 },
                    },
                    data: sevLabels.map((l) => ({
                      name: l,
                      value: stats.severityDistribution[l],
                      itemStyle: { color: SEV_HEX[l] },
                    })),
                  },
                ],
              }}
            />
          )}
        </BentoCard>

        {/* Risk Score Trend (Line) */}
        <BentoCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
            Risk Score Trend
          </h3>
          <ReactECharts
            style={{ height: 300 }}
            option={{
              tooltip: { trigger: "axis" },
              grid: { left: 40, right: 20, top: 20, bottom: 30 },
              xAxis: {
                type: "category",
                data: stats.riskScoreTrend.map((d) => d.month),
                axisLabel: { color: "#94A3B8", fontSize: 11 },
                axisLine: { lineStyle: { color: "#334155" } },
              },
              yAxis: {
                type: "value",
                min: 0,
                max: 100,
                axisLabel: { color: "#94A3B8", fontSize: 11 },
                splitLine: { lineStyle: { color: "#334155", type: "dashed" } },
              },
              series: [
                {
                  type: "line",
                  data: stats.riskScoreTrend.map((d) => d.score),
                  smooth: true,
                  lineStyle: { color: "#818CF8", width: 3 },
                  areaStyle: {
                    color: {
                      type: "linear",
                      x: 0, y: 0, x2: 0, y2: 1,
                      colorStops: [
                        { offset: 0, color: "rgba(129,140,248,0.3)" },
                        { offset: 1, color: "rgba(129,140,248,0.02)" },
                      ],
                    },
                  },
                  itemStyle: { color: "#818CF8" },
                  symbol: "circle",
                  symbolSize: 6,
                },
              ],
            }}
          />
        </BentoCard>
      </div>

      {/* ═══ MIDDLE-2 ROW — Remediation Burndown + SLA Tracker ═══ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Remediation Efficiency (Burndown) */}
        <BentoCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
            Remediation Efficiency
          </h3>
          <ReactECharts
            style={{ height: 280 }}
            option={{
              tooltip: { trigger: "axis" },
              legend: {
                data: ["New Findings", "Closed"],
                bottom: 0,
                textStyle: { color: "#94A3B8", fontSize: 12 },
              },
              grid: { left: 40, right: 20, top: 20, bottom: 40 },
              xAxis: {
                type: "category",
                data: stats.remediationTrend.map((d) => d.month),
                axisLabel: { color: "#94A3B8", fontSize: 11 },
                axisLine: { lineStyle: { color: "#334155" } },
              },
              yAxis: {
                type: "value",
                axisLabel: { color: "#94A3B8", fontSize: 11 },
                splitLine: { lineStyle: { color: "#334155", type: "dashed" } },
              },
              series: [
                {
                  name: "New Findings",
                  type: "bar",
                  data: stats.remediationTrend.map((d) => d.opened),
                  itemStyle: { color: "#F97316", borderRadius: [4, 4, 0, 0] },
                  barMaxWidth: 24,
                },
                {
                  name: "Closed",
                  type: "bar",
                  data: stats.remediationTrend.map((d) => d.closed),
                  itemStyle: { color: "#10B981", borderRadius: [4, 4, 0, 0] },
                  barMaxWidth: 24,
                },
              ],
            }}
          />
        </BentoCard>

        {/* SLA Tracker */}
        <BentoCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
            Vulnerability Aging (SLA)
          </h3>
          {stats.slaTracking.length === 0 ? (
            <p className="flex h-60 items-center justify-center text-sm text-dark-4 dark:text-dark-6">
              No open findings
            </p>
          ) : (
            <div className="space-y-3 pt-2">
              {stats.slaTracking.map((s) => {
                const isOverdue =
                  (s.severity === "Critical" && s.avgAgeDays > 7) ||
                  (s.severity === "High" && s.avgAgeDays > 14) ||
                  (s.severity === "Medium" && s.avgAgeDays > 30);
                return (
                  <div
                    key={s.severity}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      isOverdue
                        ? "border-red-300/50 bg-red-50/50 dark:border-red-500/20 dark:bg-red-900/10"
                        : "border-gray-200/60 dark:border-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getSeverityColor(s.severity)}`}
                      >
                        {s.severity}
                      </span>
                      <span className="text-sm font-medium text-dark dark:text-white">
                        {s.count} finding{s.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-sm font-bold ${isOverdue ? "text-red-500" : "text-dark-4 dark:text-dark-6"}`}
                      >
                        ~{s.avgAgeDays}d avg
                      </span>
                      {isOverdue && (
                        <span className="ml-2 text-xs font-medium text-red-500">
                          OVERDUE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>
      </div>

      {/* ═══ BOTTOM ROW — Recent Activity + Status Overview ═══ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
        <BentoCard className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
              Recent Activity
            </h3>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-dark-4 dark:text-dark-6" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-gray-200/60 bg-transparent px-2 py-1 text-xs text-dark outline-none dark:border-white/[0.1] dark:text-white"
              >
                <option value="">All Status</option>
                <option value="Open">Open</option>
                <option value="Draft">Draft</option>
                <option value="Closed">Closed</option>
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="rounded-md border border-gray-200/60 bg-transparent px-2 py-1 text-xs text-dark outline-none dark:border-white/[0.1] dark:text-white"
              >
                <option value="">All Severity</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="None">None</option>
              </select>
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <p className="flex h-40 items-center justify-center text-sm text-dark-4 dark:text-dark-6">
              {stats.recentReports.length === 0
                ? "No recent reports"
                : "No reports match the selected filters"}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedReports.map((r) => (
                  <Link
                    key={r.id}
                    href={`/reports/${r.id}/edit`}
                    className="flex items-center justify-between rounded-lg border border-gray-200/60 px-4 py-2.5 transition hover:bg-gray-50 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-dark dark:text-white">
                        {r.title}
                      </p>
                      <p className="text-xs text-dark-4 dark:text-dark-6">
                        {r.customerName}
                        {r.creatorUsername && ` · ${r.creatorUsername}`}
                        {" · "}
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString()
                          : "—"}
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          r.status === "Open"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : r.status === "Draft"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700/30 dark:text-gray-400"
                        }`}>
                          {r.status}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getSeverityColor(r.severity)}`}
                    >
                      {r.severity}
                    </span>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {activityTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t border-gray-200/60 pt-3 dark:border-white/[0.06]">
                  <p className="text-xs text-dark-4 dark:text-dark-6">
                    Showing {(activityPage - 1) * ACTIVITY_PAGE_SIZE + 1}–
                    {Math.min(activityPage * ACTIVITY_PAGE_SIZE, filteredReports.length)} of{" "}
                    {filteredReports.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={activityPage <= 1}
                      onClick={() => setActivityPage((p) => p - 1)}
                      className="rounded-md p-1.5 text-dark-4 transition hover:bg-gray-100 disabled:opacity-30 dark:text-dark-6 dark:hover:bg-white/[0.05]"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="min-w-[3rem] text-center text-xs font-medium text-dark dark:text-white">
                      {activityPage} / {activityTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={activityPage >= activityTotalPages}
                      onClick={() => setActivityPage((p) => p + 1)}
                      className="rounded-md p-1.5 text-dark-4 transition hover:bg-gray-100 disabled:opacity-30 dark:text-dark-6 dark:hover:bg-white/[0.05]"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </BentoCard>

        {/* Report Status Overview */}
        <BentoCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
            Report Status Overview
          </h3>
          {stats.totalReports === 0 ? (
            <p className="flex h-60 items-center justify-center text-sm text-dark-4 dark:text-dark-6">
              No reports yet
            </p>
          ) : (
            <>
              <ReactECharts
                style={{ height: 200 }}
                option={{
                  tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
                  series: [
                    {
                      type: "pie",
                      radius: ["45%", "72%"],
                      center: ["50%", "50%"],
                      avoidLabelOverlap: true,
                      itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: "transparent" },
                      label: { show: false },
                      emphasis: {
                        label: { show: true, fontWeight: "bold", fontSize: 13 },
                      },
                      data: [
                        { name: "Open", value: stats.openFindings, itemStyle: { color: "#10B981" } },
                        { name: "Draft", value: stats.draftCount, itemStyle: { color: "#EAB308" } },
                        {
                          name: "Closed",
                          value: stats.totalReports - stats.openFindings - stats.draftCount,
                          itemStyle: { color: "#6B7280" },
                        },
                      ].filter((d) => d.value > 0),
                    },
                  ],
                }}
              />
              <div className="mt-2 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-dark-4 dark:text-dark-6">Open</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  <span className="text-xs text-dark-4 dark:text-dark-6">Draft</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-500" />
                  <span className="text-xs text-dark-4 dark:text-dark-6">Closed</span>
                </div>
              </div>
            </>
          )}
        </BentoCard>
      </div>
    </div>
  );
}

// ─── Mini Card ───────────────────────────────────────────

function MiniCard({
  label,
  value,
  icon,
  accent,
  isFloat,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  isFloat?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1C2434]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-dark-4 dark:text-dark-6">
            {label}
          </p>
          <h4 className="mt-1 text-2xl font-bold text-dark dark:text-white">
            {isFloat ? value.toFixed(1) : value}
          </h4>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white shadow-md`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
