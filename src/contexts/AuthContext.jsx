import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tracks the current active fetch request to prevent stale async overwrites
  const fetchSessionId = useRef(0);
  const currentUserRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let initialSessionHandled = false;

    const handleSession = (currentSession) => {
      if (!isMounted) return;

      const previousUserId = currentUserRef.current?.id;
      const currentUserId = currentSession?.user?.id;
      const isNewUser = previousUserId !== currentUserId;

      currentUserRef.current = currentSession?.user ?? null;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        // Start a new fetch generation
        const currentFetchId = ++fetchSessionId.current;

        if (isNewUser) {
          setProfile(null);
          setLoading(true);
        }

        supabase
          .from("profiles")
          .select("*")
          .eq("id", currentSession.user.id)
          .single()
          .then(({ data, error }) => {
            // Cancel update if unmounted or a newer session event occurred
            if (!isMounted || currentFetchId !== fetchSessionId.current) return;

            if (error) {
              console.error("Error fetching profile:", error.message);
              setProfile(null);
            } else {
              setProfile(data);
            }
            setLoading(false);
          })
          .catch((err) => {
            if (!isMounted || currentFetchId !== fetchSessionId.current) return;
            console.error("Unexpected error fetching profile:", err);
            setProfile(null);
            setLoading(false);
          });
      } else {
        // User logged out: invalidate any pending profile fetches immediately
        fetchSessionId.current++;
        setProfile(null);
        setLoading(false);
      }
    };

    // 1. Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      initialSessionHandled = true;
      handleSession(currentSession);
    });

    // 2. Get initial session
    // Some older/alternative environments don't fire INITIAL_SESSION synchronously.
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted || initialSessionHandled) return;
      handleSession(currentSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
