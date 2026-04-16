import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Component that automatically redirects users to their appropriate dashboard
 * based on their role (admin to /insurer, worker to /worker)
 */
export default function RoleRedirect() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <p className="text-slate-300 text-lg font-semibold">Loading your dashboard...</p>
      </div>
    );
  }

  // Redirect based on role
  if (role === "admin") {
    return <Navigate to="/insurer" replace />;
  } else if (role === "worker") {
    return <Navigate to="/worker" replace />;
  }

  // Not authenticated, send to dashboard (main view)
  return <Navigate to="/dashboard" replace />;
}
