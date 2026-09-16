import { Routes, Route } from "react-router-dom";
import {
  Activity,
  Clock3,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  WalletCards,
  CalendarDays,
} from "lucide-react";

import AppLayout from "./components/layout/AppLayout";
import { Toaster } from "./components/ui/toaster";

import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import LeaveManagement from "./pages/LeaveManagement";
import BillsExpenses from "./pages/BillsExpenses";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import LeaveReports from "./pages/LeaveReports";
import EmployeeProfile from "./pages/EmployeeProfile";
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
    path: "/employees/:employeeId",
    element: <EmployeeProfile />,
    header: {
      title: "Employee Profile",
      subtitle: "View employee details",
      icon: Users,
      tone: "cyan",
    },
    allowedRoles: [ROLES.OWNER, ROLES.ACCOUNTS, ROLES.EMPLOYEE],
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
    path: "/leave",
    element: <LeaveManagement />,
    header: {
      title: "Leave Management",
      subtitle: "Request and manage employee leaves",
      icon: CalendarDays,
      tone: "amber",
    },
    allowedRoles: [ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTS],
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
    path: "/reports/leave",
    element: <LeaveReports />,
    header: {
      title: "Leave Reports",
      subtitle: "Analytics and leave request overview",
      icon: CalendarDays,
      tone: "amber",
    },
    allowedRoles: [ROLES.OWNER],
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
    allowedRoles: [ROLES.OWNER],
  },
  {
    path: "/profile",
    element: <Profile />,
    header: {
      title: "My Profile",
      subtitle: "Manage your personal and organizational info",
      icon: Users,
      tone: "lime",
    },
  },
];

export default function App() {
  return (
    <>
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
      <Toaster />
    </>
  );
}
