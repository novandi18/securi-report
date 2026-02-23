"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reports, customers, users } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { parseVector, calculateScore, type SeverityLabel } from "@/lib/cvss4";

// ─── Types ───────────────────────────────────────────────

export interface DashboardStats {
  totalReports: number;
  openFindings: number;
  criticalAlerts: number;
  averageCvss: number;
  draftCount: number;
  totalCustomers: number;
  severityDistribution: Record<SeverityLabel, number>;
  riskScoreTrend: { month: string; score: number }[];
  remediationTrend: { month: string; opened: number; closed: number }[];
  slaTracking: { severity: SeverityLabel; count: number; avgAgeDays: number }[];
  pentesterActivity: { username: string; count: number }[];
  recentReports: {
    id: string;
    title: string;
    customerName: string;
    status: string;
    severity: SeverityLabel;
    score: number;
    createdAt: Date | null;
    creatorUsername: string | null;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────

function getMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Dashboard Data Action ───────────────────────────────

export async function getDashboardStatsAction(customerId?: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  try {
    const customerFilter = customerId
      ? eq(reports.customerId, customerId)
      : undefined;

    // Fetch all reports with user info
    const allReports = await db
      .select({
        id: reports.id,
        title: reports.title,
        status: reports.status,
        cvssVector: reports.cvssVector,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
        customerName: customers.name,
        customerId: reports.customerId,
        createdBy: reports.createdBy,
        creatorUsername: users.username,
      })
      .from(reports)
      .innerJoin(customers, eq(reports.customerId, customers.id))
      .leftJoin(users, eq(reports.createdBy, users.id))
      .where(customerFilter)
      .orderBy(desc(reports.createdAt));

    // For viewer: only show Open reports
    const visibleReports =
      session.user.role === "viewer"
        ? allReports.filter((r) => r.status === "Open")
        : allReports;

    // ── Enrich with CVSS ──
    const enriched = visibleReports.map((r) => {
      if (!r.cvssVector) {
        return { ...r, severity: "None" as SeverityLabel, score: 0 };
      }
      const metrics = parseVector(r.cvssVector);
      const { score, severity } = calculateScore(metrics);
      return { ...r, severity, score };
    });

    const totalReports = enriched.length;
    const openFindings = enriched.filter((r) => r.status === "Open").length;
    const criticalAlerts = enriched.filter(
      (r) => r.severity === "Critical",
    ).length;
    const averageCvss =
      totalReports > 0
        ? Math.round(
            (enriched.reduce((s, r) => s + r.score, 0) / totalReports) * 10,
          ) / 10
        : 0;
    const draftCount = enriched.filter((r) => r.status === "Draft").length;

    // ── Severity distribution ──
    const severityDistribution: Record<SeverityLabel, number> = {
      None: 0,
      Low: 0,
      Medium: 0,
      High: 0,
      Critical: 0,
    };
    for (const r of enriched) severityDistribution[r.severity]++;

    // ── Risk Score Trend (last 6 months) ──
    const now = new Date();
    const riskScoreTrend: { month: string; score: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthReports = enriched.filter(
        (r) => r.createdAt && new Date(r.createdAt) <= endOfMonth,
      );
      const avg =
        monthReports.length > 0
          ? monthReports.reduce((s, r) => s + r.score, 0) /
            monthReports.length
          : 0;
      riskScoreTrend.push({
        month: getMonthLabel(d),
        score: Math.round(avg * 10), // 0-100
      });
    }

    // ── Remediation Trend (last 6 months) ──
    const remediationTrend: { month: string; opened: number; closed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const opened = enriched.filter(
        (r) =>
          r.createdAt &&
          new Date(r.createdAt) >= d &&
          new Date(r.createdAt) < nextMonth &&
          (r.status === "Open" || r.status === "Draft"),
      ).length;
      const closed = enriched.filter(
        (r) =>
          r.updatedAt &&
          new Date(r.updatedAt) >= d &&
          new Date(r.updatedAt) < nextMonth &&
          r.status === "Closed",
      ).length;
      remediationTrend.push({ month: getMonthLabel(d), opened, closed });
    }

    // ── SLA Tracking (open findings by severity + avg age) ──
    const openReports = enriched.filter((r) => r.status === "Open");
    const slaMap = new Map<SeverityLabel, { count: number; totalDays: number }>();
    for (const r of openReports) {
      const entry = slaMap.get(r.severity) ?? { count: 0, totalDays: 0 };
      entry.count++;
      if (r.createdAt) {
        entry.totalDays += daysBetween(new Date(r.createdAt), now);
      }
      slaMap.set(r.severity, entry);
    }
    const slaTracking = (
      ["Critical", "High", "Medium", "Low", "None"] as SeverityLabel[]
    )
      .filter((s) => slaMap.has(s))
      .map((severity) => {
        const entry = slaMap.get(severity)!;
        return {
          severity,
          count: entry.count,
          avgAgeDays: entry.count > 0 ? Math.round(entry.totalDays / entry.count) : 0,
        };
      });

    // ── Pentester Activity (admin only) ──
    const pentesterActivity: { username: string; count: number }[] = [];
    if (session.user.role === "administrator") {
      const activityMap = new Map<string, number>();
      for (const r of enriched) {
        const name = r.creatorUsername ?? "Unknown";
        activityMap.set(name, (activityMap.get(name) ?? 0) + 1);
      }
      for (const [username, count] of activityMap) {
        pentesterActivity.push({ username, count });
      }
      pentesterActivity.sort((a, b) => b.count - a.count);
    }

    // ── Recent reports (all, client handles pagination/filtering) ──
    const recentReports = enriched.map((r) => ({
      id: r.id,
      title: r.title,
      customerName: r.customerName,
      status: r.status ?? "Draft",
      severity: r.severity,
      score: r.score,
      createdAt: r.createdAt,
      creatorUsername: r.creatorUsername,
    }));

    // ── Total customers ──
    const customerRows = customerId
      ? [{ count: 1 }]
      : await db.select({ count: sql<number>`COUNT(*)` }).from(customers);
    const totalCustomers = Number(customerRows[0]?.count ?? 0);

    return {
      success: true as const,
      data: {
        totalReports,
        openFindings,
        criticalAlerts,
        averageCvss,
        draftCount,
        totalCustomers,
        severityDistribution,
        riskScoreTrend,
        remediationTrend,
        slaTracking,
        pentesterActivity,
        recentReports,
      } satisfies DashboardStats,
    };
  } catch (error) {
    console.error("getDashboardStatsAction:", error);
    return {
      success: false as const,
      error: "Failed to fetch dashboard data",
      data: null,
    };
  }
}

// ─── Customer List for Dropdown ──────────────────────────

export async function getCustomersForDashboardAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const data = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .orderBy(customers.name);

    return { success: true as const, data };
  } catch (error) {
    console.error("getCustomersForDashboardAction:", error);
    return {
      success: false as const,
      error: "Failed to fetch customers",
      data: [],
    };
  }
}
