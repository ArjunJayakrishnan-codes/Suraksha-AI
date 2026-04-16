import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "worker";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Role must be defined for authenticated users
  if (!role) {
    return <Navigate to="/auth" replace />;
  }

  // Check role if specified
  if (requiredRole && role !== requiredRole) {
    // Redirect to appropriate dashboard based on actual role
    if (role === "admin") {
      return <Navigate to="/insurer" replace />;
    } else {
      return <Navigate to="/worker" replace />;
    }
  }

  return <>{children}</>;
}
