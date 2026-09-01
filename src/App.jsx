import { Routes, Route } from "react-router-dom";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckSquare,
  Clock3,
  LayoutDashboard,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";

import AppLayout from "./components/layout/AppLayout";

import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import LeaveManagement from "./pages/LeaveManagement";
import BillsExpenses from "./pages/BillsExpenses";
import Tasks from "./pages/Tasks";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RoleRoute from "./components/auth/RoleRoute";
import { ROLES } from "./constants/roles";

// Each route entry maps a path to its page component and the header props
// that <AppLayout> forwards to <Header>.
const routes = [
  {
    path: "/",
    element: <Dashboard />,
    header: {
      title: "Dashboard",
      subtitle: "Overview of your workforce and daily operations",
      icon: Sparkles,
      tone: "coral",
    },
  },
  {
    path: "/employees",
    element: <Employees />,
    header: {
      title: "Employees",
      subtitle: "Manage your workforce directory",
      icon: Users,
      tone: "cyan",
    },
    allowedRoles: [ROLES.OWNER, ROLES.ACCOUNTS],
  },
  {
    path: "/attendance",
    element: <Attendance />,
    header: {
      title: "Attendance",
      subtitle: "Track daily check-in and check-out",
      icon: Clock3,
      tone: "lime",
    },
  },
  {
    path: "/leave-management",
    element: <LeaveManagement />,
    header: {
      title: "Leave Management",
      subtitle: "Review and approve leave requests",
      icon: CalendarDays,
      tone: "amber",
    },
  },
  {
    path: "/bills",
    element: <BillsExpenses />,
    header: {
      title: "Bills & Expenses",
      subtitle: "Manage and approve employee expense claims",
      icon: WalletCards,
      tone: "coral",
    },
  },
  {
    path: "/tasks",
    element: <Tasks />,
    header: {
      title: "Tasks",
      subtitle: "Track operational tasks and assignments",
      icon: CheckSquare,
      tone: "violet",
    },
  },
  {
    path: "/reports",
    element: <Reports />,
    header: {
      title: "Reports",
      subtitle: "Analytics and workforce insights",
      icon: Activity,
      tone: "lime",
    },
    allowedRoles: [ROLES.OWNER, ROLES.ACCOUNTS],
  },
  {
    path: "/notifications",
    element: <Notifications />,
    header: {
      title: "Notifications",
      subtitle: "Your alerts and activity feed",
      icon: Bell,
      tone: "coral",
    },
  },
  {
    path: "/settings",
    element: <Settings />,
    header: {
      title: "Settings",
      subtitle: "Manage your account and preferences",
      icon: SettingsIcon,
      tone: "violet",
    },
  },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        {routes.map(({ path, element, header, allowedRoles }) => {
          const routeElement = allowedRoles ? (
            <RoleRoute allowedRoles={allowedRoles}>{element}</RoleRoute>
          ) : (
            element
          );

          return (
            <Route key={path} element={<AppLayout headerProps={header} />}>
              <Route path={path} element={routeElement} />
            </Route>
          );
        })}
        {/* 404 — also wrapped in AppLayout so Sidebar stays visible */}
        <Route
          element={
            <AppLayout
              headerProps={{
                title: "Page Not Found",
                subtitle: "This page does not exist",
                tone: "coral",
              }}
            />
          }
        >
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
