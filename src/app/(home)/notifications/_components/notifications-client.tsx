"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
  type NotificationData,
} from "@/lib/actions/notification";
import { resetUserPasswordAction } from "@/lib/actions/user";
import { useToast } from "@/components/ui/toast";
import { TablePagination } from "@/components/ui/table-pagination";

// ────────────────────────────────────────────────────────────
// Category display info
// ────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  collaboration: {
    label: "Collaboration",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  security: {
    label: "Security",
    color:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  engagement: {
    label: "Engagement",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  system: {
    label: "System",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

const TYPE_ICON_BG: Record<string, string> = {
  password_reset_request:
    "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  report_released:
    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  brute_force_detected:
    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  "2fa_state_change":
    "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  sla_alert:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  pdf_generated:
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  pdf_failed:
    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  user_created:
    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  general: "bg-primary/10 text-primary",
};

// ────────────────────────────────────────────────────────────
// Format relative time
// ────────────────────────────────────────────────────────────
function formatTimeAgo(date: Date | string | null) {
  if (!date) return "";
  const now = Date.now();
  const d = new Date(date).getTime();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return new Date(date).toLocaleDateString();
}

type FilterCategory = "all" | "collaboration" | "security" | "engagement" | "system";
type FilterStatus = "all" | "unread" | "read";

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export function NotificationsClient({
  notifications: initial,
}: {
  notifications: NotificationData[];
}) {
  const [items, setItems] = useState(initial);
  const [category, setCategory] = useState<FilterCategory>("all");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const router = useRouter();
  const { addToast } = useToast();

  // ── Filters ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = items;
    if (category !== "all") {
      list = list.filter((n) => n.category === category);
    }
    if (status === "unread") list = list.filter((n) => !n.isRead);
    if (status === "read") list = list.filter((n) => n.isRead);
    return list;
  }, [items, category, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items],
  );

  // ── Handlers ─────────────────────────────────────────────
  const markRead = useCallback(
    async (id: string) => {
      const result = await markNotificationReadAction(id);
      if (result.success) {
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
      }
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    const result = await markAllNotificationsReadAction();
    if (result.success) {
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  }, []);

  const deleteNotification = useCallback(
    async (id: string) => {
      const result = await deleteNotificationAction(id);
      if (result.success) {
        setItems((prev) => prev.filter((n) => n.id !== id));
        addToast("Notification deleted", "success");
      }
    },
    [addToast],
  );

  const handleApproveReset = useCallback(
    async (notification: NotificationData) => {
      if (!notification.actorId) return;
      setActionLoading(notification.id);

      const result = await resetUserPasswordAction(notification.actorId);
      if (result.success) {
        const emailNote = result.emailSent
          ? "New credentials sent via email."
          : "Email delivery failed — check the Users page for the generated password.";
        addToast(
          `Password reset for "${notification.actorUsername || "user"}". ${emailNote}`,
          result.emailSent ? "success" : "warning",
        );
        setItems((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n,
          ),
        );
        router.refresh();
      } else {
        addToast(result.error || "Failed to reset password.", "error");
      }
      setActionLoading(null);
    },
    [addToast, router],
  );

  const handleNavigate = useCallback(
    (notification: NotificationData) => {
      if (notification.actionUrl) {
        if (!notification.isRead) markRead(notification.id);
        router.push(notification.actionUrl);
      }
    },
    [markRead, router],
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-gray-dark">
        {/* Category filter */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "collaboration", "security", "engagement", "system"] as const).map(
            (cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  setCurrentPage(1);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  category === cat
                    ? "bg-primary text-white"
                    : "bg-gray-2 text-dark-5 hover:bg-gray-3 dark:bg-dark-3 dark:text-dark-6 dark:hover:bg-dark-4",
                )}
              >
                {cat === "all" ? "All" : CATEGORY_LABELS[cat]?.label ?? cat}
              </button>
            ),
          )}
        </div>

        {/* Read status filter */}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as FilterStatus);
              setCurrentPage(1);
            }}
            className="rounded-md border border-stroke bg-transparent px-3 py-1.5 text-xs text-dark dark:border-dark-3 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              Mark all read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {paginated.length === 0 ? (
          <div className="rounded-lg border border-stroke bg-white px-4 py-16 text-center dark:border-dark-3 dark:bg-gray-dark">
            <p className="text-sm text-dark-5 dark:text-dark-6">
              No notifications found.
            </p>
          </div>
        ) : (
          paginated.map((item) => {
            const bgClass =
              TYPE_ICON_BG[item.type] || TYPE_ICON_BG.general;
            const catInfo = CATEGORY_LABELS[item.category];
            const isClickable =
              !!item.actionUrl && item.type !== "password_reset_request";

            return (
              <div
                key={item.id}
                className={cn(
                  "group flex items-start gap-4 rounded-lg border border-stroke bg-white px-4 py-3 transition-colors dark:border-dark-3 dark:bg-gray-dark",
                  !item.isRead &&
                    "border-l-4 border-l-primary bg-primary/[0.02] dark:bg-primary/[0.04]",
                  isClickable && "cursor-pointer hover:bg-gray-1 dark:hover:bg-dark-2",
                )}
                onClick={isClickable ? () => handleNavigate(item) : undefined}
              >
                {/* Icon */}
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full",
                    bgClass,
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="16" y2="12" />
                    <line x1="12" x2="12.01" y1="8" y2="8" />
                  </svg>
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong
                      className={cn(
                        "text-sm font-semibold",
                        !item.isRead
                          ? "text-dark dark:text-white"
                          : "text-dark-4 dark:text-dark-6",
                      )}
                    >
                      {item.title}
                    </strong>
                    {catInfo && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          catInfo.color,
                        )}
                      >
                        {catInfo.label}
                      </span>
                    )}
                    {!item.isRead && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </div>

                  {item.message && (
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        !item.isRead
                          ? "text-dark-5 dark:text-dark-6"
                          : "text-dark-6 dark:text-dark-7",
                      )}
                    >
                      {item.message}
                    </p>
                  )}

                  <div className="mt-1 flex items-center gap-3 text-xs text-dark-5 dark:text-dark-6">
                    <span>{formatTimeAgo(item.createdAt)}</span>
                    {item.actorUsername && (
                      <span>by {item.actorUsername}</span>
                    )}
                  </div>

                  {/* Password reset approval */}
                  {item.type === "password_reset_request" && !item.isRead && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={actionLoading === item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApproveReset(item);
                        }}
                        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {actionLoading === item.id
                          ? "Resetting..."
                          : "Approve & Reset"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(item.id);
                        }}
                        className="rounded-md border border-stroke px-3 py-1 text-xs font-medium text-dark-5 transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-dark-6 dark:hover:bg-dark-3"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!item.isRead && item.type !== "password_reset_request" && (
                    <button
                      title="Mark as read"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(item.id);
                      }}
                      className="rounded-md p-1.5 text-dark-5 transition-colors hover:bg-gray-2 hover:text-primary dark:text-dark-6 dark:hover:bg-dark-3"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </button>
                  )}
                  <button
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    className="rounded-md p-1.5 text-dark-5 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-dark-6 dark:hover:bg-red-900/20"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <TablePagination
          totalItems={filtered.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}
