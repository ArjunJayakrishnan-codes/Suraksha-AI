import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  role: "admin" | "worker" | null;
  signUp: (email: string, password: string, fullName: string, role: "admin" | "worker") => Promise<void>;
  signIn: (email: string, password: string, role: "admin" | "worker") => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<"admin" | "worker" | null>(null);
  const isMountedRef = useRef(true);
  const MOCK_ROLE_REGISTRY_KEY = "mock_auth_role_registry";

  function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  function getMockRoleRegistry(): Record<string, "admin" | "worker"> {
    const raw = localStorage.getItem(MOCK_ROLE_REGISTRY_KEY);
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, "admin" | "worker">;
    } catch {
      return {};
    }
  }

  function setMockRoleRegistry(registry: Record<string, "admin" | "worker">): void {
    localStorage.setItem(MOCK_ROLE_REGISTRY_KEY, JSON.stringify(registry));
  }

  async function fetchUserRole(token: string) {
    try {
      const response = await fetch("/api/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!isMountedRef.current) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setRole(data.role as "admin" | "worker");
        setIsAdmin(Boolean(data.is_admin));
      } else {
        setRole(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Failed to fetch user role:", error);
      if (!isMountedRef.current) {
        return;
      }
      setRole(null);
      setIsAdmin(false);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        const mockSessionRaw = localStorage.getItem("mock_auth_session");
        if (mockSessionRaw) {
          try {
            const parsed = JSON.parse(mockSessionRaw);
            const supabaseClient = getSupabase();
            const hasMockToken = typeof parsed?.access_token === "string" && parsed.access_token.startsWith("mock-");
            // Old mock sessions may have user but no role; treat them as invalid.
            if (!parsed?.role || !parsed?.user || (supabaseClient && hasMockToken)) {
              localStorage.removeItem("mock_auth_session");
            } else if (isMountedRef.current) {
              setSession(parsed);
              setUser(parsed.user ?? null);
              setRole((parsed.role as "admin" | "worker" | null) ?? null);
              setIsAdmin(parsed.role === "admin");
              setLoading(false);
              return;
            }
          } catch {
            localStorage.removeItem("mock_auth_session");
          }
        }

        const supabase = getSupabase();
        if (!supabase) {
          if (isMountedRef.current) {
            setUser(null);
            setSession(null);
            setRole(null);
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMountedRef.current) {
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.access_token) {
          await fetchUserRole(currentSession.access_token);
        } else {
          setRole(null);
          setIsAdmin(false);
          setLoading(false);
        }

        const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
          if (!isMountedRef.current) {
            return;
          }

          setSession(nextSession);
          setUser(nextSession?.user ?? null);

          if (nextSession?.access_token) {
            await fetchUserRole(nextSession.access_token);
          } else {
            setRole(null);
            setIsAdmin(false);
            setLoading(false);
          }
        });

        unsubscribe = () => data.subscription.unsubscribe();
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (isMountedRef.current) {
          setUser(null);
          setSession(null);
          setRole(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      isMountedRef.current = false;
      unsubscribe?.();
    };
  }, []);

  async function signUp(email: string, password: string, fullName: string, selectedRole: "admin" | "worker") {
    const supabase = getSupabase();
    if (!supabase) {
      const normalizedEmail = normalizeEmail(email);
      const roleRegistry = getMockRoleRegistry();
      const existingRole = roleRegistry[normalizedEmail];
      if (existingRole && existingRole !== selectedRole) {
        throw new Error(`This account is registered as ${existingRole}. Please sign in as ${existingRole}.`);
      }

      const mockUser = {
        id: `mock-user-${normalizedEmail.replace(/[^a-z0-9]/g, "_")}`,
        email: normalizedEmail,
        user_metadata: { full_name: fullName },
      };
      const mockSession = {
        access_token: `mock-token-${Date.now()}`,
        user: mockUser,
        role: selectedRole,
      };
      roleRegistry[normalizedEmail] = selectedRole;
      setMockRoleRegistry(roleRegistry);
      localStorage.setItem("mock_auth_session", JSON.stringify(mockSession));
      if (isMountedRef.current) {
        setUser(mockUser as User);
        setSession(mockSession as Session);
        setRole(selectedRole);
        setIsAdmin(selectedRole === "admin");
        setLoading(false);
      }
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      throw error;
    }

    const token = data.session?.access_token;
    if (token) {
      const roleRegistrationResponse = await fetch("/api/auth/register-role", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      if (!roleRegistrationResponse.ok) {
        await supabase.auth.signOut();
        const registrationErr = await roleRegistrationResponse.json().catch(() => ({}));
        throw new Error(registrationErr.detail || "Unable to register account role. Please try again.");
      }
    }

    if (isMountedRef.current) {
      setRole(selectedRole);
      setIsAdmin(selectedRole === "admin");
    }
  }

  async function signIn(email: string, password: string, selectedRole: "admin" | "worker") {
    const supabase = getSupabase();
    if (!supabase) {
      const normalizedEmail = normalizeEmail(email);
      const roleRegistry = getMockRoleRegistry();
      const existingRole = roleRegistry[normalizedEmail];
      if (existingRole && existingRole !== selectedRole) {
        throw new Error(`This account is registered as ${existingRole}. Please sign in as ${existingRole}.`);
      }

      const mockUser = {
        id: `mock-user-${normalizedEmail.replace(/[^a-z0-9]/g, "_")}`,
        email: normalizedEmail,
        user_metadata: { full_name: normalizedEmail.split("@")[0] },
      };
      const mockSession = {
        access_token: `mock-token-${Date.now()}`,
        user: mockUser,
        role: selectedRole,
      };
      roleRegistry[normalizedEmail] = existingRole ?? selectedRole;
      setMockRoleRegistry(roleRegistry);
      localStorage.setItem("mock_auth_session", JSON.stringify(mockSession));
      if (isMountedRef.current) {
        const resolvedRole = roleRegistry[normalizedEmail];
        setUser(mockUser as User);
        setSession({ ...mockSession, role: resolvedRole } as Session);
        setRole(resolvedRole);
        setIsAdmin(resolvedRole === "admin");
        setLoading(false);
      }
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }

    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Unable to verify account role for this login.");
    }

    const roleRegistrationResponse = await fetch("/api/auth/register-role", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: selectedRole }),
    });
    if (!roleRegistrationResponse.ok && roleRegistrationResponse.status !== 409) {
      await supabase.auth.signOut();
      throw new Error("Unable to register account role. Please try again.");
    }

    if (roleRegistrationResponse.status === 409) {
      const conflictData = await roleRegistrationResponse.json().catch(() => ({}));
      await supabase.auth.signOut();
      throw new Error(conflictData.detail || "This account is registered for a different role.");
    }

    const response = await fetch("/api/user/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      await supabase.auth.signOut();
      throw new Error("Unable to verify account role. Please try again.");
    }

    const profile = await response.json();
    const actualRole = profile.role as "admin" | "worker";
    if (actualRole !== selectedRole) {
      await supabase.auth.signOut();
      throw new Error(`This account is registered as ${actualRole}. Please sign in as ${actualRole}.`);
    }

    if (isMountedRef.current) {
      setRole(actualRole);
      setIsAdmin(actualRole === "admin");
    }
  }

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) {
      localStorage.removeItem("mock_auth_session");
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setRole(null);
        setIsAdmin(false);
        setLoading(false);
      }
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, role, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
