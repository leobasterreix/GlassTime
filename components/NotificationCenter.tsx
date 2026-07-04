"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMounted, useTrack } from "@/lib/store";
import { fmtRelativeOrDate } from "@/lib/utils";

export default function NotificationCenter() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } =
    useTrack();
  const [open, setOpen] = useState(false);

  if (pathname === "/login") return null;

  const unread = mounted ? notifications.filter((n) => !n.read).length : 0;

  return (
    <>
      <button
        className="notif-bell pressable"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <>
          <div className="notif-scrim" onClick={() => setOpen(false)} />
          <div className="glass notif-panel">
            <div className="row" style={{ justifyContent: "space-between", padding: "14px 16px 10px" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>Notifications</h2>
              <button className="tiny pressable" style={{ fontWeight: 700 }} onClick={() => setOpen(false)}>
                Fermer
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="empty" style={{ padding: "24px 16px" }}>
                <div className="big">🔔</div>
                <p className="muted">Rien de nouveau pour le moment.</p>
              </div>
            ) : (
              <>
                <div className="stack" style={{ maxHeight: "60vh", overflowY: "auto", padding: "0 10px 10px" }}>
                  {notifications.map((n) => {
                    const content = (
                      <div
                        className="row"
                        style={{ gap: 10, padding: "10px 8px", alignItems: "flex-start" }}
                      >
                        <span style={{ fontSize: 19 }}>{n.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: n.read ? 500 : 700 }}>
                            {n.message}
                          </div>
                          <div className="tiny" style={{ marginTop: 2 }}>
                            {fmtRelativeOrDate(n.createdAt)}
                          </div>
                        </div>
                        {!n.read && <span className="notif-unread-mark" />}
                      </div>
                    );
                    return n.href ? (
                      <Link
                        key={n.id}
                        href={n.href}
                        className="pressable"
                        style={{ display: "block", borderRadius: 12 }}
                        onClick={() => {
                          markNotificationRead(n.id);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        key={n.id}
                        className="pressable"
                        style={{ borderRadius: 12, cursor: "pointer" }}
                        onClick={() => markNotificationRead(n.id)}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
                <div className="row" style={{ gap: 8, padding: "6px 16px 16px" }}>
                  <button
                    className="chip pressable"
                    style={{ flex: 1 }}
                    onClick={markAllNotificationsRead}
                  >
                    Tout marquer lu
                  </button>
                  <button className="chip pressable" style={{ flex: 1 }} onClick={clearNotifications}>
                    Tout effacer
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
