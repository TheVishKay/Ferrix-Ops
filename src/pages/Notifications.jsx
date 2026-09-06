import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { notifications as initialNotifications } from "@/data/mockData";
import { EmptyState } from "@/components/shared";

const toneClass = (t) => `hr-tone-${t}`;

const typeIcons = {
  leave: "📅",
  bill: "💳",
  task: "✅",
  attendance: "🕐",
};

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState(initialNotifications);

  const markRead = (id) =>
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  const dismiss = (id) => setItems((prev) => prev.filter((n) => n.id !== id));

  const unread = items.filter((n) => !n.read).length;

  return (
    <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="font-display text-3xl font-black tracking-tight text-foreground">
            {unread > 0 ? (
              <Badge className="hr-soft-badge hr-tone-coral text-sm font-bold py-1 px-3">
                <span className="hr-mini-dot" />
                {unread} unread
              </Badge>
            ) : (
              <Badge className="hr-soft-badge hr-tone-lime text-sm font-bold py-1 px-3">
                <span className="hr-mini-dot" />
                All caught up
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
              <Check className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Notification list */}
      <div className="hr-card p-0 divide-y divide-border">
        {items.length === 0 && (
          <EmptyState icon={Bell} title="No notifications" subtitle="You're all caught up!" />
        )}
        {items.map((notif) => (
          <div
            key={notif.id}
            className={`flex items-start gap-4 p-5 transition-colors ${
              !notif.read ? "bg-accent/40" : ""
            }`}
          >
            {/* Type emoji */}
            <div className={`hr-icon-box ${toneClass(notif.tone)} mt-0.5 shrink-0 size-10`}>
              <span className="text-base" aria-hidden="true">
                {typeIcons[notif.type] ?? "🔔"}
              </span>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                <div className="flex shrink-0 items-center gap-1">
                  {!notif.read && (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: "var(--hr-coral)" }}
                      aria-label="Unread"
                    />
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {relativeTime(notif.time)}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{notif.message}</p>
              <div className="mt-3 flex items-center gap-2">
                {notif.link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      markRead(notif.id);
                      navigate(notif.link);
                    }}
                  >
                    View
                  </Button>
                )}
                {!notif.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => markRead(notif.id)}
                  >
                    <Check className="size-3" /> Mark read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => dismiss(notif.id)}
                  aria-label="Dismiss"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
