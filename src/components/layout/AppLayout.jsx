import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

/**
 * AppLayout wraps every page with the shared Sidebar + Header shell.
 * The page's title/subtitle/icon are passed via the `<Outlet context>` mechanism,
 * but for simplicity each page passes its own header config through the
 * `headerProps` prop on this wrapper. Pages that need custom headers
 * (like Dashboard) can opt out by rendering their own header inside the main area.
 *
 * Usage in App.jsx:
 *   <Route element={<AppLayout />}>
 *     <Route path="/" element={<Dashboard />} />
 *     ...
 *   </Route>
 */
export default function AppLayout({ headerProps }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="hr-app min-h-screen bg-background text-foreground">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="lg:ml-64">
        <Header onMenuOpen={() => setMobileNavOpen(true)} {...(headerProps ?? {})} />
        <Outlet />
      </div>
    </div>
  );
}
