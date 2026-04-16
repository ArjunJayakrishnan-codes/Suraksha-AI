import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Shield, Briefcase, AlertCircle } from "lucide-react";

export default function RoleSelection() {
  const { user, selectRole } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<"admin" | "worker" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSelectRole = async (role: "admin" | "worker") => {
    setLoading(true);
    setError("");
    try {
      setSelectedRole(role);
      await selectRole(role);
      // Navigate to main dashboard after role selection
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select role");
      setLoading(false);
      setSelectedRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Header Logo */}
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center">
          <span className="font-bold text-white text-lg">🛡️</span>
        </div>
        <div className="flex flex-col">
          <span className="font-display text-lg font-bold text-white">Gig Guardian</span>
          <span className="text-xs text-slate-400">Protection Platform</span>
        </div>
      </div>

      <div className="w-full max-w-4xl">
        {/* Main Content */}
        <div className="mb-12">
          <h1 className="text-5xl font-display font-bold text-white mb-3">Welcome, {user?.user_metadata?.full_name || user?.email || "User"}</h1>
          <p className="text-xl text-slate-300">Select your role to continue</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Worker Card */}
          <Card
            className={`border-2 cursor-pointer transition-all ${
              selectedRole === "worker"
                ? "border-amber-500 bg-gradient-to-br from-amber-600/20 to-orange-600/20"
                : "border-amber-600/30 bg-gradient-to-br from-slate-800 to-slate-900 hover:border-amber-500/50"
            }`}
            onClick={() => !loading && handleSelectRole("worker")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Worker</CardTitle>
                    <CardDescription className="text-slate-400">Manage your gig income</CardDescription>
                  </div>
                </div>
                {selectedRole === "worker" && (
                  <Badge className="bg-amber-600 text-white border-0">Selected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">✓</span>
                  <span>View and manage your active policies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">✓</span>
                  <span>Submit and track insurance claims</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">✓</span>
                  <span>Monitor payout history and earnings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">✓</span>
                  <span>Access real-time coverage details</span>
                </li>
              </ul>
              <Button
                onClick={() => !loading && handleSelectRole("worker")}
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white border-0 font-bold"
              >
                {loading && selectedRole === "worker" ? "Selecting..." : "Continue as Worker"}
              </Button>
            </CardContent>
          </Card>

          {/* Admin Card */}
          <Card
            className={`border-2 cursor-pointer transition-all ${
              selectedRole === "admin"
                ? "border-red-500 bg-gradient-to-br from-red-600/20 to-orange-600/20"
                : "border-red-600/30 bg-gradient-to-br from-slate-800 to-slate-900 hover:border-red-500/50"
            }`}
            onClick={() => !loading && handleSelectRole("admin")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-orange-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Admin / Insurer</CardTitle>
                    <CardDescription className="text-slate-400">Manage claims & fraud detection</CardDescription>
                  </div>
                </div>
                {selectedRole === "admin" && (
                  <Badge className="bg-red-600 text-white border-0">Selected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✓</span>
                  <span>Review and approve worker claims</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✓</span>
                  <span>Advanced fraud detection analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✓</span>
                  <span>Monitor payout processing & analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✓</span>
                  <span>Manage admin users and policies</span>
                </li>
              </ul>
              <Button
                onClick={() => !loading && handleSelectRole("admin")}
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white border-0 font-bold"
              >
                {loading && selectedRole === "admin" ? "Selecting..." : "Continue as Admin"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <div className="mt-8 p-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-slate-300">
            <span className="text-blue-300 font-semibold">Note:</span> You can change your role at any time from the main dashboard. This selection determines your default access level and feature set.
          </p>
        </div>
      </div>
    </div>
  );
}
