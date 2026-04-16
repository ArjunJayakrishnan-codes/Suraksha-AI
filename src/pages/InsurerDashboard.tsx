import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, Activity, DollarSign, CheckCircle2, TrendingUp, Zap, BarChart3, Users, Cloud, AlertCircle } from "lucide-react";
import { authenticatedFetch, authenticatedFetchAll } from "@/lib/api-client";
import ClaimApprovalQueue from "@/components/ClaimApprovalQueue";
import AdminWorkerManagement from "@/components/AdminWorkerManagement";

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
  description: string;
  claim_amount: number;
  status: string;
}

interface FraudAnalysis {
  is_fraudulent: boolean;
  risk_score: number;
  flags: string[];
  reason: string;
}

interface PayoutRecord {
  payout_id: string;
  status: string;
  amount: number;
  gateway: string;
  created_at: string;
}

interface AdminAnalytics {
  loss_ratio: number;
  loss_ratio_percentage: number;
  metrics: {
    total_claims: number;
    approved_claims: number;
    pending_claims: number;
    rejected_claims: number;
    total_premium_pool: number;
    total_approved_payout: number;
    total_active_policies: number;
  };
  predictive_analytics: {
    high_disruption_likelihood: number;
    predicted_claims: number;
    predicted_loss: number;
    risk_factors: string[];
    exposure_active_policies?: number;
    forecast_source?: string;
    forecast_location?: {
      lat: number;
      lon: number;
    };
  };
  fraud_metrics: {
    pending_high_risk: number;
    pending_total: number;
    high_risk_percentage: number;
  };
}

export default function InsurerDashboard() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [fraudAlerts, setFraudAlerts] = useState<Record<string, FraudAnalysis>>({});
  const [advScanResult, setAdvScanResult] = useState<any | null>(null);
  const [payoutSimResult, setPayoutSimResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"claims" | "workers">("claims");

  const fetchData = async () => {
    try {
      setAnalyticsError(null);
      // Fetch intelligent analytics
      const analyticsRes = await authenticatedFetch("/api/dashboard/admin-analytics");
      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      } else {
        setAnalyticsError("Unable to load predictive analytics right now. Please refresh after sign-in.");
      }

      // Also fetch detailed data
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
      setAnalyticsError("Unable to load predictive analytics right now. Please refresh after sign-in.");
    }
    setLoading(false);
  };

  const triggerAdvancedScan = async () => {
    try {
      const response = await authenticatedFetch('/api/fraud-advanced', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setAdvScanResult(data);
      }
    } catch (e) {
      console.error('Advanced scan error', e);
    }
  };

  const triggerPayoutSim = async () => {
    try {
      const response = await authenticatedFetch('/api/payout-sim', {
        method: 'POST',
        body: JSON.stringify({ max_count: 6, amount: 150 })
      });
      if (response.ok) {
        const data = await response.json();
        setPayoutSimResult(data);
        await fetchData();
      }
    } catch (e) {
      console.error('Payout sim error', e);
    }
  };

  useEffect(() => {
    fetchData();

    // Keep payout/claims widgets current after admin actions.
    const intervalId = window.setInterval(() => {
      fetchData();
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, []);

  const activePolicies = useMemo(() => policies.filter((p) => p.active), [policies]);
  const totalCoverage = activePolicies.length * 100000;
  const monthlyPremium = activePolicies.reduce((sum, p) => sum + Number(p.weekly_premium || 0), 0) * 4;
  const totalPayoutsProcessed = payouts.reduce((sum, p) => sum + p.amount, 0);
  const successfulPayouts = payouts.filter((p) => p.status === "success").length;
  const fraudulentClaims = Object.values(fraudAlerts).filter((a) => a.is_fraudulent).length;
  const averageRiskScore =
    Object.values(fraudAlerts).length > 0
      ? (Object.values(fraudAlerts).reduce((sum, a) => sum + a.risk_score, 0) / Object.values(fraudAlerts).length).toFixed(2)
      : "0.00";

  const predictedLossDisplay = useMemo(() => {
    if (!analytics?.predictive_analytics) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(analytics.predictive_analytics.predicted_loss || 0);
  }, [analytics]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b bg-slate-950/80 backdrop-blur sticky top-0 z-40 shadow-lg">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-white">Insurer Dashboard</span>
            <Badge className="bg-red-600 hover:bg-red-700 text-white border-0 font-bold">ADMIN</Badge>
          </div>
        </div>
      </header>

      <main className="container py-10 space-y-10">
        {/* Title & Controls */}
        <div>
          <h1 className="text-5xl font-display font-bold text-white">Loss Prevention & Analytics</h1>
          <p className="text-xl text-slate-300 mt-3">Monitor claims, detect fraud patterns, and process payouts</p>
          
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <Button size="lg" onClick={triggerAdvancedScan} className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white border-0 font-bold shadow-lg">
              🔍 Run Advanced Fraud Scan
            </Button>
            <Button size="lg" onClick={triggerPayoutSim} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 font-bold shadow-lg">
              💰 Simulate Payouts
            </Button>
            {advScanResult && (
              <div className="ml-4 text-sm text-white px-4 py-2 bg-gradient-to-r from-yellow-600/30 to-orange-600/30 rounded-lg border border-yellow-500/30 font-semibold">
                Last scan: <span className="text-yellow-300 font-bold">{advScanResult.flagged_count}/{advScanResult.scanned}</span> flagged
              </div>
            )}
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur border border-blue-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-300 font-bold tracking-widest">👥 ACTIVE POLICIES</p>
                  <p className="text-4xl font-bold text-blue-300 mt-3">{analytics?.metrics?.total_active_policies || 0}</p>
                </div>
                <Users className="h-12 w-12 text-blue-400 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-red-600/20 to-red-700/20 backdrop-blur border border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-300 font-bold tracking-widest">🚨 FRAUD FLAGS</p>
                  <p className="text-4xl font-bold text-red-300 mt-3">{analytics?.fraud_metrics?.pending_high_risk || 0}</p>
                  <p className="text-xs text-red-200 mt-2">{analytics?.fraud_metrics?.high_risk_percentage || 0}% of pending</p>
                </div>
                <AlertTriangle className="h-12 w-12 text-red-400 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 backdrop-blur border border-emerald-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-300 font-bold tracking-widest">💳 TOTAL PAYOUTS</p>
                  <p className="text-4xl font-bold text-emerald-300 mt-3">₹{((analytics?.metrics?.total_approved_payout || 0) / 1000).toFixed(0)}k</p>
                </div>
                <DollarSign className="h-12 w-12 text-emerald-400 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur border border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-300 font-bold tracking-widest">� LOSS RATIO</p>
                  <p className="text-4xl font-bold text-purple-300 mt-3">{(analytics?.loss_ratio_percentage || 0).toFixed(1)}%</p>
                  <p className="text-xs text-purple-200 mt-2">Payout to Premium</p>
                </div>
                <TrendingUp className="h-12 w-12 text-purple-400 opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fraud Detection Section */}
        <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <CardTitle className="text-white">🚨 Advanced Fraud Detection</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              GPS spoofing, fake weather claims, duplicate submissions analyzed in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {advScanResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-lg border border-blue-500/30">
                    <p className="text-xs text-blue-300 font-bold tracking-widest">SCANNED CLAIMS</p>
                    <p className="text-3xl font-bold text-blue-300 mt-2">{advScanResult.scanned}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-600/20 to-red-700/20 rounded-lg border border-red-500/30">
                    <p className="text-xs text-red-300 font-bold tracking-widest">FLAGGED</p>
                    <p className="text-3xl font-bold text-red-300 mt-2">{advScanResult.flagged_count}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-600/20 to-orange-700/20 rounded-lg border border-orange-500/30">
                    <p className="text-xs text-orange-300 font-bold tracking-widest">FRAUD RATE</p>
                    <p className="text-3xl font-bold text-orange-300 mt-2">
                      {advScanResult.scanned > 0 ? ((advScanResult.flagged_count / advScanResult.scanned) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600 text-slate-400 text-xs">
                  Last run: {new Date(advScanResult.timestamp).toLocaleString()}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Click "Run Advanced Fraud Scan" to analyze recent claims.</p>
            )}
          </CardContent>
        </Card>

        {/* Payout Analytics */}
        <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <CardTitle className="text-white">💰 Instant Payout System</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Simulated payment gateways: UPI, Razorpay, Stripe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 rounded-lg border border-emerald-500/30">
                <p className="text-xs text-emerald-300 font-bold tracking-widest">SUCCESSFUL PAYOUTS</p>
                <p className="text-3xl font-bold text-emerald-300 mt-2">{successfulPayouts}</p>
                <p className="text-xs text-emerald-300/70 mt-1">Out of {payouts.length} total</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-cyan-600/20 to-blue-700/20 rounded-lg border border-cyan-500/30">
                <p className="text-xs text-cyan-300 font-bold tracking-widest">TOTAL AMOUNT PAID</p>
                <p className="text-3xl font-bold text-cyan-300 mt-2">₹{totalPayoutsProcessed.toLocaleString()}</p>
                <p className="text-xs text-cyan-300/70 mt-1">Avg: ₹{(totalPayoutsProcessed / Math.max(payouts.length, 1)).toFixed(0)}</p>
              </div>
            </div>

            {payoutSimResult && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg border border-blue-500/30">
                <p className="text-sm font-semibold text-blue-300">
                  ✅ Simulation: <span className="text-purple-300 font-bold">{payoutSimResult.simulated}</span> payouts processed
                </p>
              </div>
            )}

            {payouts.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-300 mb-3">Recent Payouts</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {payouts.slice(0, 6).map((payout) => (
                    <div key={payout.payout_id} className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition">
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-emerald-300">₹{payout.amount}</strong>
                        <Badge className={payout.status === "success" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-yellow-600 hover:bg-yellow-700"}>
                          {payout.status === "success" ? "✓" : "⏳"} {payout.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 font-semibold">{payout.gateway.toUpperCase()}</p>
                      <p className="text-xs text-slate-500">{new Date(payout.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Predictive Analytics Section */}
        <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-cyan-400" />
              <CardTitle className="text-white">🔮 Predictive Analytics for Next Week</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Weather forecasting and disruption likelihood
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.predictive_analytics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-orange-600/20 to-orange-700/20 rounded-lg border border-orange-500/30">
                    <p className="text-xs text-orange-300 font-bold tracking-widest">DISRUPTION LIKELIHOOD</p>
                    <p className="text-4xl font-bold text-orange-300 mt-2">
                      {(analytics.predictive_analytics.high_disruption_likelihood * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-600/20 to-red-700/20 rounded-lg border border-red-500/30">
                    <p className="text-xs text-red-300 font-bold tracking-widest">PREDICTED CLAIMS</p>
                    <p className="text-4xl font-bold text-red-300 mt-2">{analytics.predictive_analytics.predicted_claims}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-600/20 to-red-700/20 rounded-lg border border-red-500/30">
                    <p className="text-xs text-red-300 font-bold tracking-widest">PROJECTED LOSS</p>
                    <p className="text-3xl font-bold text-red-300 mt-2">{predictedLossDisplay}</p>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  Source: {analytics.predictive_analytics.forecast_source || "unknown"} · Exposure: {analytics.predictive_analytics.exposure_active_policies ?? 0} active policies
                  {analytics.predictive_analytics.forecast_location
                    ? ` · Forecast Location: ${analytics.predictive_analytics.forecast_location.lat.toFixed(2)}, ${analytics.predictive_analytics.forecast_location.lon.toFixed(2)}`
                    : ""}
                </div>
                
                <div className="mt-4 p-4 bg-yellow-600/10 rounded-lg border border-yellow-500/30">
                  <p className="text-xs text-yellow-300 font-bold tracking-widest mb-3">⚠️ RISK FACTORS</p>
                  <ul className="space-y-2">
                    {analytics.predictive_analytics.risk_factors.map((factor, i) => (
                      <li key={i} className="text-sm text-yellow-200 flex items-start gap-2">
                        <span className="text-yellow-400 font-bold">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : analyticsError ? (
              <Alert className="bg-red-600/10 border-red-500/40">
                <AlertCircle className="h-4 w-4 text-red-300" />
                <AlertDescription className="text-red-200 text-sm">{analyticsError}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-slate-400">Loading predictive data...</p>
            )}
          </CardContent>
        </Card>

        {/* Admin Management Tabs */}
        <div className="mt-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-3xl font-bold text-white">📋 Admin Management</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => setAdminTab("claims")}
                className={`${
                  adminTab === "claims"
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-0"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600"
                }`}
              >
                🔔 Claim Queue
              </Button>
              <Button
                onClick={() => setAdminTab("workers")}
                className={`${
                  adminTab === "workers"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600"
                }`}
              >
                👥 Worker Management
              </Button>
            </div>
          </div>

          {/* Claim Approval Queue */}
          {adminTab === "claims" && <ClaimApprovalQueue />}

          {/* Worker Management */}
          {adminTab === "workers" && <AdminWorkerManagement />}
        </div>

        {/* Claims Summary */}
        <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <CardHeader>
            <CardTitle className="text-white">📊 Claims Summary</CardTitle>
            <CardDescription className="text-slate-400">Overall claim statistics and status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-lg border border-blue-500/30">
                <p className="text-xs text-blue-300 font-bold tracking-widest">TOTAL CLAIMS</p>
                <p className="text-3xl font-bold text-blue-300 mt-2">{claims.length}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 rounded-lg border border-yellow-500/30">
                <p className="text-xs text-yellow-300 font-bold tracking-widest">PENDING</p>
                <p className="text-3xl font-bold text-yellow-300 mt-2">{claims.filter(c => c.status === "pending").length}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 rounded-lg border border-emerald-500/30">
                <p className="text-xs text-emerald-300 font-bold tracking-widest">APPROVED</p>
                <p className="text-3xl font-bold text-emerald-300 mt-2">{claims.filter(c => c.status === "approved").length}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-600/20 to-purple-700/20 rounded-lg border border-purple-500/30">
                <p className="text-xs text-purple-300 font-bold tracking-widest">PAID OUT</p>
                <p className="text-3xl font-bold text-purple-300 mt-2">{claims.filter(c => c.status === "paid_out").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
