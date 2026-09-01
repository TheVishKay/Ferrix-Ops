import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function ProtectedRoute() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-sm rounded-2xl border border-destructive/20 bg-card p-6 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-destructive">Profile Error</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Your account is authenticated, but your application profile could not be loaded. Please
            contact your administrator.
          </p>
          <Button variant="outline" onClick={signOut} className="w-full">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
