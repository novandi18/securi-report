"use client";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { BellIcon } from "./icons";
import {
  getAdminNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationData,
} from "@/lib/actions/notification";
import { resetUserPasswordAction } from "@/lib/actions/user";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

const TYPE_ICON: Record<string, { bg: string; icon: React.ReactNode }> = {
  password_reset_request: {
    bg: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  contribution_submitted: {
    bg: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
      </svg>
    ),
  },
  report_merged: {
    bg: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>
      </svg>
    ),
  },
  report_released: {
    bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
      </svg>
    ),
  },
  brute_force_detected: {
    bg: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
      </svg>
    ),
  },
  "2fa_state_change": {
    bg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  sla_alert: {
    bg: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  pdf_generated: {
    bg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>
      </svg>
    ),
  },
  pdf_failed: {
    bg: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" x2="15" y1="15" y2="15"/>
      </svg>
    ),
  },
  user_created: {
    bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" x2="19" y1="8" y2="14" />
        <line x1="22" x2="16" y1="11" y2="11" />
      </svg>
    ),
  },
  general: {
    bg: "bg-primary/10 text-primary",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="16" y2="12" />
        <line x1="12" x2="12.01" y1="8" y2="8" />
      </svg>
    ),
  },
};

function formatTimeAgo(date: Date | null) {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function Notification() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { addToast } = useToast();
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    const result = await getAdminNotificationsAction(20);
    if (result.success) {
      setNotifications(result.data);
      setUnreadCount(result.data.filter((n) => !n.isRead).length);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function handleApproveReset(notification: NotificationData) {
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
      await fetchNotifications();
      router.refresh();
    } else {
      addToast(result.error || "Failed to reset password.", "error");
    }

    setActionLoading(null);
  }

  function handleNotificationClick(notification: NotificationData) {
    if (notification.actionUrl) {
      if (!notification.isRead) {
        markNotificationReadAction(notification.id);
      }
      setIsOpen(false);
      router.push(notification.actionUrl);
    }
  }

  async function handleMarkRead(notificationId: string) {
    await markNotificationReadAction(notificationId);
    await fetchNotifications();
  }

  async function handleMarkAllRead() {
    await markAllNotificationsReadAction();
    await fetchNotifications();
  }

  return (
    <Dropdown
      isOpen={isOpen}
      setIsOpen={(open) => {
        setIsOpen(open);
      }}
    >
      <DropdownTrigger
        className="grid size-12 place-items-center rounded-full border bg-gray-2 text-dark outline-none hover:text-primary focus-visible:border-primary focus-visible:text-primary dark:border-dark-4 dark:bg-dark-3 dark:text-white dark:focus-visible:border-primary"
        aria-label="View Notifications"
      >
        <span className="relative">
          <BellIcon />

          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -right-1 -top-1 z-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-light px-1 text-[10px] font-bold text-white ring-2 ring-gray-2 dark:ring-dark-3",
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
              <span className="absolute inset-0 -z-1 animate-ping rounded-full bg-red-light opacity-75" />
            </span>
          )}
        </span>
      </DropdownTrigger>

      <DropdownContent
        align={isMobile ? "end" : "center"}
        className="border border-stroke bg-white px-3.5 py-3 shadow-md dark:border-dark-3 dark:bg-gray-dark min-[350px]:min-w-[22rem]"
      >
        <div className="mb-1 flex items-center justify-between px-2 py-1.5">
          <span className="text-lg font-medium text-dark dark:text-white">
            Notifications
          </span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <>
                <span className="rounded-md bg-primary px-[9px] py-0.5 text-xs font-medium text-white">
                  {unreadCount} new
                </span>
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              </>
            )}
          </div>
        </div>

        <ul className="mb-3 max-h-[23rem] space-y-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-dark-5 dark:text-dark-6">
              No notifications
            </li>
          ) : (
            notifications.map((item) => {
              const typeInfo =
                TYPE_ICON[item.type] || TYPE_ICON.general;
              const isClickable = !!item.actionUrl && item.type !== "password_reset_request";

              return (
                <li
                  key={item.id}
                  role="menuitem"
                  className={cn(
                    "rounded-lg px-2 py-2",
                    !item.isRead && "bg-primary/5 dark:bg-primary/10",
                    isClickable && "cursor-pointer transition-colors hover:bg-gray-2 dark:hover:bg-dark-3",
                  )}
                  onClick={isClickable ? () => handleNotificationClick(item) : undefined}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full",
                        typeInfo.bg,
                      )}
                    >
                      {typeInfo.icon}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="block truncate text-sm font-medium text-dark dark:text-white">
                          {item.title}
                        </strong>
                        <span className="shrink-0 text-xs text-dark-5 dark:text-dark-6">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      {item.message && (
                        <p className="mt-0.5 text-xs text-dark-5 dark:text-dark-6 line-clamp-2">
                          {item.message}
                        </p>
                      )}

                      {/* Action buttons for password reset requests */}
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
                              handleMarkRead(item.id);
                            }}
                            className="rounded-md border border-stroke px-3 py-1 text-xs font-medium text-dark-5 transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-dark-6 dark:hover:bg-dark-3"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      {/* Mark read button for other unread notifications */}
                      {item.type !== "password_reset_request" && !item.isRead && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(item.id);
                          }}
                          className="mt-1 text-xs text-primary hover:underline"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* View All link */}
        <div className="border-t border-stroke px-2 pt-2 dark:border-dark-3">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              router.push("/notifications");
            }}
            className="w-full rounded-md py-1.5 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            View All Notifications
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
