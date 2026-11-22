"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, ExternalLink, Clock } from "lucide-react";
import { fetchMyNotificationsApi, markNotificationReadApi, clearAllNotificationsApi } from "@/lib/api/officer-portal";
import { getSocket, onNotificationReceived, onNotificationRead, onNotificationCleared } from "@/lib/realtime/socket-client";

export interface NotificationItem {
  id: string;
  complaintId?: string | null;
  complaintTrackingNumber?: string | null;
  title: string;
  message: string;
  type: string;
  channel?: string;
  isRead: boolean;
  createdAt: string;
  link?: string | null;
}

function cleanNotificationText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\s*\([A-Za-z_\s]+ priority\)/gi, "")
    .replace(/\s*\(priority:?\s*[A-Za-z_\s]+\)/gi, "")
    .replace(/\bRegistered\b/gi, "Submitted")
    .replace(/New [A-Za-z_\s]+ Complaint Routed/gi, "New Complaint Routed")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return "Yesterday";
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetchMyNotificationsApi();
      setItems(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Ignore background fetch failure
    }
  }, []);

  // Initial load + Real-time Socket.IO Listeners
  useEffect(() => {
    loadNotifications();

    // Connect to Socket.IO singleton
    const socket = getSocket();

    const unsubNew = onNotificationReceived((newNotification: NotificationItem) => {
      setItems((prev) => {
        // Prevent duplicate notification addition
        if (prev.some((item) => item.id === newNotification.id)) {
          return prev;
        }
        return [newNotification, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
    });

    const unsubRead = onNotificationRead((data: any) => {
      if (data?.all) {
        setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
      } else if (data?.id) {
        setItems((prev) =>
          prev.map((item) => (item.id === data.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    });

    const unsubCleared = onNotificationCleared(() => {
      setItems([]);
      setUnreadCount(0);
    });

    return () => {
      unsubNew();
      unsubRead();
      unsubCleared();
    };
  }, [loadNotifications]);

  const handleMarkRead = async (id: string | "all") => {
    try {
      if (id === "all") {
        setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
      } else {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      await markNotificationReadApi(id);
    } catch {
      // ignore
    }
  };

  const handleClearAll = async () => {
    try {
      setItems([]);
      setUnreadCount(0);
      await clearAllNotificationsApi();
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      handleMarkRead(n.id);
    }
    setOpen(false);

    if (n.complaintTrackingNumber) {
      router.push(`/complaints/track?id=${encodeURIComponent(n.complaintTrackingNumber)}`);
    } else if (n.link) {
      router.push(n.link);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) loadNotifications();
        }}
        aria-label="Notifications"
        className="relative p-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-[#F8FAFC] dark:bg-[#161F30] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0B4EA2]/30"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#1E293B] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between bg-[#F8FAFC] dark:bg-[#1E293B]/40">
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#0B4EA2] dark:text-[#60A5FA]" />
                Notifications ({unreadCount})
              </span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead("all")}
                    className="text-[11px] font-semibold text-[#0B4EA2] dark:text-[#60A5FA] hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] font-semibold text-[#DC2626] hover:text-[#B91C1C] hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
              {items.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 text-[#94A3B8] mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                    No notifications yet.
                  </p>
                  <p className="text-[10px] text-[#94A3B8] dark:text-[#64748B] mt-0.5">
                    Updates about your complaints will appear here in real time.
                  </p>
                </div>
              ) : (
                items.slice(0, 20).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left p-3 text-xs transition-colors group relative ${
                      n.isRead
                        ? "bg-white dark:bg-[#111827] opacity-80 hover:bg-[#F8FAFC] dark:hover:bg-[#1A2234]"
                        : "bg-[#EAF2FF]/60 dark:bg-[#1E3A8A]/25 hover:bg-[#EAF2FF] dark:hover:bg-[#1E3A8A]/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {cleanNotificationText(n.title)}
                        </span>
                        {n.complaintTrackingNumber && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-[#E2E8F0] dark:bg-[#2D3748] text-[#334155] dark:text-[#CBD5E1]">
                            #{n.complaintTrackingNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#0B4EA2] dark:bg-[#60A5FA]" />
                        )}
                        <ExternalLink className="w-3 h-3 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] mt-1 leading-snug">
                      {cleanNotificationText(n.message)}
                    </p>

                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[#94A3B8] dark:text-[#64748B]">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(n.createdAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
