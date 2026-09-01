import { NavLink } from "react-router-dom";
import { ROLES } from "../../constants/roles";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckSquare,
  Clock3,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { notifications } from "@/data/mockData";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  {
    label: "Employees",
    icon: Users,
    to: "/employees",
    allowedRoles: [ROLES.OWNER, ROLES.ACCOUNTS],
  },
  { label: "Attendance", icon: Clock3, to: "/attendance" },
  { label: "Leave Management", icon: CalendarDays, to: "/leave-management" },
  { label: "Bills & Expenses", icon: WalletCards, to: "/bills" },
  { label: "Tasks", icon: CheckSquare, to: "/tasks" },
  { label: "Reports", icon: Activity, to: "/reports", allowedRoles: [ROLES.OWNER, ROLES.ACCOUNTS] },
  { label: "Notifications", icon: Bell, to: "/notifications" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

const unreadCount = notifications.filter((n) => !n.read).length;

export default function Sidebar({ mobileOpen, onClose }) {
  const { profile, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "??";

  const displayRole = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1).toLowerCase()
    : "No Role Assigned";

  const visibleNavItems = navItems.filter((item) => {
    if (!item.allowedRoles) return true;
    if (!profile) return false;
    return item.allowedRoles.includes(profile.role);
  });

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={onClose}
        />
      )}

      <aside
        className={`hr-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border p-5 transition-transform duration-200 lg:z-20 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 px-2 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hr-logo hr-tone-coral" aria-hidden="true">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="font-display truncate text-lg font-black tracking-tight text-sidebar-foreground">
                LanternHR
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/60">
                Ops Console
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 text-sidebar-foreground lg:hidden"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <div className="hr-hairline my-5" />

        {/* Nav items */}
        <nav className="flex flex-col gap-1" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                className={({ isActive }) =>
                  `hr-nav-item flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                    isActive ? "hr-nav-active" : ""
                  }`
                }
                aria-label={item.label}
              >
                {({ isActive }) => (
                  <>
                    <Icon className="size-[17px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.label === "Notifications" && unreadCount > 0 && (
                      <span className="ml-auto hr-nav-count">{unreadCount}</span>
                    )}
                    {isActive && item.to !== "/" && <span className="sr-only">(current page)</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto">
          <div className="hr-hairline mb-4" />
          <div className="flex items-center gap-3 p-2">
            <Avatar className="size-10 rounded-xl">
              <AvatarFallback className="hr-avatar hr-tone-coral">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {profile?.full_name || "Unknown User"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">{displayRole}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={signOut}
            className="hr-nav-item mt-1 w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
            aria-label="Log out"
          >
            <LogOut className="size-[17px]" />
            <span>Log out</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
