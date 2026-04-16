import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, DollarSign, CheckCircle2, Zap, Shield, TrendingUp, AlertCircle } from "lucide-react";
import { authenticatedFetch, authenticatedFetchAll } from "@/lib/api-client";

interface Policy {
  id: string;
  worker_name: string;
  policy_number: string;
  coverage_type: string;
  weekly_premium: number;
  active: boolean;
}

interface Claim {
  id: string;
  policy_id: string;
  title: string;
  claim_amount: number;
  status: string;
}

interface PayoutRecord {
  payout_id: string;
  status: string;
  amount: number;
  gateway: string;
  created_at: string;
}

interface WorkerAnalytics {
  earnings_protected: number;
  active_policies: number;
  weekly_coverage: number;
  claims: {
    pending: number;
    approved: number;
    rejected: number;
    paid_out: number;
  };
  total_approved_amount: number;
  claim_count: number;
}

export default function WorkerDashboard() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [analytics, setAnalytics] = useState<WorkerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // Fetch intelligent analytics first
      const analyticsRes = await authenticatedFetch("/api/dashboard/worker-analytics");
      
      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }

      // Also fetch detailed data for display
      const [policiesRes, claimsRes, payoutsRes] = await authenticatedFetchAll([
        ["/api/policies"],
        ["/api/claims"],
        ["/api/payouts"],
      ]);
      
      if (policiesRes.ok) setPolicies(await policiesRes.json());
      if (claimsRes.ok) setClaims(await claimsRes.json());
      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        setPayouts(data.payouts || []);
      }
    } catch (e) {
      console.error("Error fetching data:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Keep worker dashboard in sync with admin payout actions.
    const intervalId = window.setInterval(() => {
      fetchData();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Use analytics data if available, fallback to manual calculation
  const totalCoverage = analytics?.earnings_protected || 0;
  const monthlyPremium = (analytics?.weekly_coverage || 0) * 4;
  const totalPayoutsFromLedger = payouts
    .filter((payout) => payout.status === "success")
    .reduce((sum, payout) => sum + (payout.amount || 0), 0);
  const totalPayoutsReceived = Math.max(analytics?.total_approved_amount || 0, totalPayoutsFromLedger);
  const pendingClaims = analytics?.claims?.pending || 0;
  const approvedClaims = analytics?.claims?.approved || 0;
  const activePoliciesList = policies.filter((policy) => policy.active);
  const successfulPayouts = payouts.filter((payout) => payout.status === "success").length;
  const totalClaimAmount = claims.reduce((sum, claim) => sum + (claim.claim_amount || 0), 0);

  const getClaimStatusLabel = (status: string) => {
    if (status === "paid_out") return "Already Done";
    return status.replace(/_/g, " ");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b bg-slate-950/80 backdrop-blur sticky top-0 z-40 shadow-lg">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-white">Worker Dashboard</span>
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">LIVE</Badge>
          </div>
        </div>
      </header>

      <main className="container py-10 space-y-10">
        {/* Hero Section */}
        <div>
          <h1 className="text-5xl font-display font-bold text-white">Your Earnings Protection</h1>
          <p className="text-xl text-slate-300 mt-3">Real-time coverage, claims, and instant payouts</p>
        </div>

        {/* Top Stats - Large cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-2xl hover:shadow-emerald-500/50 transition-shadow">
            <CardContent className="pt-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-emerald-100 text-xs font-bold tracking-widest">💰 EARNINGS PROTECTED</p>
                  <p className="text-6xl font-display font-black mt-3">₹{totalCoverage.toLocaleString()}</p>
                  <p className="text-emerald-100 text-sm mt-3 font-semibold">{activePoliciesList.length} Active Polic{activePoliciesList.length !== 1 ? "ies" : "y"}</p>
                </div>
                <Shield className="h-20 w-20 text-emerald-200 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-700 text-white shadow-2xl hover:shadow-blue-500/50 transition-shadow">
            <CardContent className="pt-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-100 text-xs font-bold tracking-widest">💳 PAYOUTS RECEIVED</p>
                  <p className="text-6xl font-display font-black mt-3">₹{totalPayoutsReceived.toLocaleString()}</p>
                  <p className="text-blue-100 text-sm mt-3 font-semibold">{successfulPayouts} Successful Transfer{successfulPayouts !== 1 ? "s" : ""}</p>
                </div>
                <DollarSign className="h-20 w-20 text-blue-200 opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur border border-purple-500/30">
            <CardContent className="pt-6">
              <p className="text-xs text-purple-300 font-bold tracking-widest">📊 MONTHLY PREMIUM</p>
              <p className="text-3xl font-bold text-purple-300 mt-3">₹{monthlyPremium.toLocaleString()}</p>
              <p className="text-xs text-purple-300/70 mt-2">Auto-deducted weekly</p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-yellow-600/20 to-orange-700/20 backdrop-blur border border-yellow-500/30">
            <CardContent className="pt-6">
              <p className="text-xs text-yellow-300 font-bold tracking-widest">⏳ PENDING CLAIMS</p>
              <p className="text-3xl font-bold text-yellow-300 mt-3">{pendingClaims}</p>
              <p className="text-xs text-yellow-300/70 mt-2">Under review</p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-emerald-600/20 to-teal-700/20 backdrop-blur border border-emerald-500/30">
            <CardContent className="pt-6">
              <p className="text-xs text-emerald-300 font-bold tracking-widest">✅ APPROVED CLAIMS</p>
              <p className="text-3xl font-bold text-emerald-300 mt-3">{approvedClaims}</p>
              <p className="text-xs text-emerald-300/70 mt-2">Ready for payout</p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-cyan-600/20 to-blue-700/20 backdrop-blur border border-cyan-500/30">
            <CardContent className="pt-6">
              <p className="text-xs text-cyan-300 font-bold tracking-widest">📋 TOTAL CLAIMS</p>
              <p className="text-3xl font-bold text-cyan-300 mt-3">₹{totalClaimAmount.toLocaleString()}</p>
              <p className="text-xs text-cyan-300/70 mt-2">Amount claimed</p>
            </CardContent>
          </Card>
        </div>

        {/* Coverage Details */}
        <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              <CardTitle className="text-white">Active Coverage Plans</CardTitle>
            </div>
            <CardDescription className="text-slate-400">Your current insurance policies</CardDescription>
          </CardHeader>
          <CardContent>
            {activePoliciesList.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No active policies yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activePoliciesList.map((policy) => (
                  <div key={policy.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-emerald-500/50 transition">
                    <div>
                      <p className="font-bold text-sm text-emerald-400">{policy.coverage_type.toUpperCase()}</p>
                      <p className="text-xs text-slate-400 mt-1">{policy.policy_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-emerald-300">₹{policy.weekly_premium}/week</p>
                      <Badge className="bg-emerald-600 text-white border-0 mt-2">✓ Active</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payouts */}
        {payouts.length > 0 && (
          <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                <CardTitle className="text-white">Recent Payouts</CardTitle>
              </div>
              <CardDescription className="text-slate-400">Your instant transfer history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {payouts.slice(0, 10).map((payout) => (
                  <div key={payout.payout_id} className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 rounded-lg border border-cyan-500/30">
                    <div>
                      <p className="font-bold text-cyan-300">₹{payout.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {payout.gateway.toUpperCase()} • {new Date(payout.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {(() => {
                      const status = String(payout.status || "unknown").toLowerCase();
                      const isSuccess = status === "success";
                      const isFailed = status === "failed";
                      const badgeClass = isSuccess
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        : isFailed
                          ? "bg-red-600 hover:bg-red-700 text-white border-0"
                          : "bg-yellow-600 hover:bg-yellow-700 text-white border-0";
                      const label = isSuccess ? "Received" : isFailed ? "Failed" : status.charAt(0).toUpperCase() + status.slice(1);

                      return (
                        <Badge className={badgeClass}>
                          {isSuccess ? "✓" : isFailed ? "✕" : "⏳"} {label}
                        </Badge>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Claims */}
        {claims.length > 0 && (
          <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                <CardTitle className="text-white">My Claims</CardTitle>
              </div>
              <CardDescription className="text-slate-400">Status of submitted claims</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {claims.map((claim) => (
                  <div key={claim.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition">
                    <div>
                      <p className="font-semibold text-sm text-slate-100">{claim.title}</p>
                      <p className="text-xs text-slate-400 mt-1">₹{claim.claim_amount}</p>
                    </div>
                    <Badge 
                      className={
                        claim.status === "pending" ? "bg-yellow-600 hover:bg-yellow-700" :
                        claim.status === "approved" ? "bg-emerald-600 hover:bg-emerald-700" :
                        claim.status === "paid_out" ? "bg-cyan-600 hover:bg-cyan-700" :
                        "bg-red-600 hover:bg-red-700"
                      }
                    >
                      {claim.status === "pending" ? "⏳" : claim.status === "approved" ? "✅" : claim.status === "paid_out" ? "💰" : "❌"} {getClaimStatusLabel(claim.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Banner */}
        <Card className="border-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 backdrop-blur border border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-300">How It Works</p>
                <p className="text-blue-200 mt-1">
                  📝 Submit a claim → 🤖 AI analyzes for fraud → ✅ Claim approved → 💳 Instant payout via UPI/Razorpay/Stripe
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
