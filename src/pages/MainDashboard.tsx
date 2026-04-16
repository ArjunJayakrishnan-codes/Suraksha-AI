import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Shield, Briefcase, Settings, LogOut, Activity, TrendingUp, Users } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";

interface DashboardStats {
  totalPolicies?: number;
  activeClaims?: number;
  pendingApprovals?: number;
  totalPayouts?: number;
}

export default function MainDashboard() {
  const { user, role, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard stats based on role
    const fetchStats = async () => {
      try {
        if (isAdmin) {
          const claimsRes = await authenticatedFetch("/api/admin/claims");
          if (claimsRes.ok) {
            const claimsData = await claimsRes.json();
            setStats({
              pendingApprovals: claimsData.pending?.length || 0,
              totalPayouts: claimsData.paid_out?.length || 0,
            });
          }
        } else {
          const policiesRes = await authenticatedFetch("/api/policies");
          const claimsRes = await authenticatedFetch("/api/claims");
          if (policiesRes.ok && claimsRes.ok) {
            const policiesData = await policiesRes.json();
            const claimsData = await claimsRes.json();
            setStats({
              totalPolicies: policiesData.length || 0,
              activeClaims: claimsData.length || 0,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleNavigateToDashboard = () => {
    navigate(isAdmin ? "/insurer" : "/worker");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="container h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-lg">🛡️</span>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">Gig Guardian</h1>
              <p className="text-xs text-slate-400">Main Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge className={isAdmin ? "bg-red-600 hover:bg-red-700 text-white border-0" : "bg-amber-600 hover:bg-amber-700 text-white border-0"}>
              {isAdmin ? "ADMIN" : "WORKER"}
            </Badge>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-12 space-y-12">
        {/* Welcome Section */}
        <div>
          <h2 className="text-4xl font-display font-bold text-white mb-2">Welcome back, {user?.user_metadata?.full_name || user?.email || "User"}!</h2>
          <p className="text-lg text-slate-400">
            {isAdmin
              ? "You have admin/insurer access. Manage claims, detect fraud, and process payouts."
              : "Protect your gig income with our comprehensive insurance platform."}
          </p>
        </div>

        {/* Quick Stats */}
        {!loading && (
          <div className={`grid gap-4 ${isAdmin ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
            {isAdmin ? (
              <>
                <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">Pending Approvals</CardTitle>
                      <Activity className="w-5 h-5 text-yellow-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-yellow-300">{stats.pendingApprovals || 0}</p>
                    <p className="text-sm text-slate-400 mt-1">Claims awaiting review</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">Total Payouts</CardTitle>
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-emerald-300">{stats.totalPayouts || 0}</p>
                    <p className="text-sm text-slate-400 mt-1">Successfully processed</p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">Active Policies</CardTitle>
                      <Shield className="w-5 h-5 text-emerald-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-emerald-300">{stats.totalPolicies || 0}</p>
                    <p className="text-sm text-slate-400 mt-1">Protecting your income</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">Active Claims</CardTitle>
                      <Activity className="w-5 h-5 text-blue-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-blue-300">{stats.activeClaims || 0}</p>
                    <p className="text-sm text-slate-400 mt-1">Claims in progress</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Role-Specific Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Primary Dashboard Card */}
          <Card className="border-2 border-gradient-to-r bg-gradient-to-br from-slate-800 to-slate-900 md:col-span-2 lg:col-span-1 hover:border-opacity-100 transition-all">
            <CardHeader>
              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-orange-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-white">
                    {isAdmin ? "Admin Dashboard" : "Worker Dashboard"}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {isAdmin
                      ? "Manage claims, detect fraud, and process payouts"
                      : "View policies, submit claims, and track payouts"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-6">
                {isAdmin
                  ? "Access the full admin console with claim approval queue, fraud analysis, and payout management."
                  : "Monitor your active policies, submit insurance claims, and track your earnings protection."}
              </p>
              <Button
                onClick={handleNavigateToDashboard}
                className={`w-full ${
                  isAdmin
                    ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                    : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                } text-white border-0 font-bold text-lg py-6`}
              >
                Go to {isAdmin ? "Admin" : "Worker"} Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between text-left border-slate-600 hover:bg-slate-700 text-white"
                onClick={() => navigate(isAdmin ? "/insurer" : "/worker")}
              >
                <span>Access Main Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between text-left border-slate-600 hover:bg-slate-700 text-white"
                onClick={() => navigate("/auth")}
              >
                <span>Change Account</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <Alert className="border-blue-500/50 bg-blue-600/20">
          <Users className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-300 ml-2">
            You are currently logged in as <span className="font-bold">{user?.email}</span> with <span className="font-bold">{isAdmin ? "Admin" : "Worker"}</span> access.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  );
}
