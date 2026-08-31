import { useNavigate } from "react-router-dom";
import { Bell, Menu, Search, Settings } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifications } from "@/data/mockData";

const unreadCount = notifications.filter((n) => !n.read).length;

export default function Header({ onMenuOpen, title, subtitle, icon: Icon, tone = "coral" }) {
  const navigate = useNavigate();

  return (
    <header className="hr-header sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:justify-between">
        {/* Mobile hamburger */}
        <Button
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11 lg:hidden"
          aria-label="Open navigation"
          onClick={onMenuOpen}
        >
          <Menu />
        </Button>

        {/* Page title */}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className={`hr-mark hr-tone-${tone} hidden sm:grid`} aria-hidden="true">
                <Icon className="size-4" />
              </span>
            )}
            <h1 className="font-display truncate text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
          </div>
          {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {/* Right controls */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <label className="hr-search hidden md:flex">
            <Search className="size-4 text-muted-foreground" />
            <Input
              aria-label="Search employees and bills"
              placeholder="Search employees, bills…"
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </label>

          <Button
            variant="outline"
            size="icon"
            className="relative min-h-11 min-w-11"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            onClick={() => navigate("/notifications")}
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="hr-notification-dot" aria-label="Unread notifications" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            aria-label="Settings"
            onClick={() => navigate("/settings")}
          >
            <Settings className="size-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Avatar className="size-10 rounded-xl">
              <AvatarFallback className="hr-avatar hr-tone-coral">AV</AvatarFallback>
            </Avatar>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-foreground">Admin</p>
              <p className="text-xs text-muted-foreground">HR Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
