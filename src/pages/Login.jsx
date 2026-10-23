import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex flex-col items-center justify-center gap-2 text-center">
          <div
            className="hr-logo hr-tone-coral flex items-center justify-center rounded-xl p-3"
            aria-hidden="true"
          >
            <Sparkles className="size-6 text-primary" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-black tracking-tight">
            Sign in to ferrixOps
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your details below to access your account
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="h-10"
            />
          </div>

          <Button type="submit" className="mt-2 w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
