import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, FileText, Trash2, AlertTriangle, CheckCircle2, DollarSign, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Policy {
  id: string;
  policy_number: string;
  worker_name: string;
}

interface Claim {
  id: string;
  policy_id: string;
  claim_number: string;
  title: string;
  description: string;
  claim_amount: number;
  status: string;
  admin_notes?: string;
}

interface FraudAnalysis {
  is_fraudulent: boolean;
  risk_score: number;
  flags: string[];
  reason: string;
  recommendation: string;
}

interface PayoutRecord {
  payout_id: string;
  status: string;
  amount: number;
  gateway: string;
  transaction_details: Record<string, any>;
  created_at: string;
}

const ClaimsManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fraudAnalyses, setFraudAnalyses] = useState<Record<string, FraudAnalysis>>({});
  const [pendingPayouts, setPendingPayouts] = useState<Record<string, PayoutRecord>>({});
  const [form, setForm] = useState({
    policy_id: "",
    claim_number: "",
    title: "",
    description: "",
    claim_amount: "",
  });

  const authHeaders = async (includeJson = false) => {
    const headers: Record<string, string> = {};
    if (includeJson) headers["Content-Type"] = "application/json";
    const supabase = getSupabase();
    if (!supabase) return headers;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const parseError = async (response: Response) => {
    const body = await response.json().catch(() => null);
    if (!body) return response.statusText || "Unknown error";
    if (typeof body.detail === "string") return body.detail;
    return JSON.stringify(body.detail || body);
  };

  const checkClaimFraud = async (claim: Claim) => {
    try {
      const response = await fetch("/api/fraud-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token",
        },
        body: JSON.stringify({
          claim: {
            id: claim.id,
            title: claim.title,
            description: claim.description,
            claim_amount: claim.claim_amount,
            delivery_location: "Downtown Area",
            weather_condition: ["rainy", "sunny", "clear"][Math.floor(Math.random() * 3)],
            claim_date: new Date().toISOString().split("T")[0],
            claim_frequency: Math.floor(Math.random() * 4),
          },
          include_history: true,
        }),
      });

      if (response.ok) {
        const analysis = await response.json();
        setFraudAnalyses((prev) => ({ ...prev, [claim.id]: analysis }));
      }
    } catch (err) {
      console.error("Fraud check error:", err);
    }
  };

  const processPayout = async (claim: Claim) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/payouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token",
        },
        body: JSON.stringify({
          claim_id: claim.id,
          amount: claim.claim_amount,
          recipient_identifier: "worker@example.upi",
          gateway: "upi",
        }),
      });

      if (!response.ok) throw new Error(await parseError(response));

      const payout = await response.json();
      setPendingPayouts((prev) => ({ ...prev, [claim.id]: payout }));

      // Update claim status to paid_out
      await updateClaimStatus(claim.id, "paid_out");
    } catch (err) {
      setError((err as Error).message || "Failed to process payout.");
    } finally {
      setLoading(false);
    }
  };

  const updateClaimStatus = async (claimId: string, status: string) => {
    try {
      const response = await fetch(`/api/claims/${claimId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders(true)),
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      await loadAll();
    } catch (err) {
      console.error("Failed to update claim status:", err);
    }
  };

  const loadAll = async (preferredPolicyId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const [policyRes, claimRes] = await Promise.all([
        fetch("/api/policies", { headers: await authHeaders() }),
        fetch("/api/claims", { headers: await authHeaders() }),
      ]);
      if (!policyRes.ok) throw new Error(await parseError(policyRes));
      if (!claimRes.ok) throw new Error(await parseError(claimRes));

      const policyData = await policyRes.json();
      const claimData = await claimRes.json();
      setPolicies(Array.isArray(policyData) ? policyData : []);
      setClaims(Array.isArray(claimData) ? claimData : []);
      
      // Analyze fraud for all claims
      if (Array.isArray(claimData)) {
        for (const claim of claimData) {
          if (!fraudAnalyses[claim.id]) {
            await checkClaimFraud(claim);
          }
        }
      }

      setForm((prev) => {
        const availablePolicyIds = new Set((Array.isArray(policyData) ? policyData : []).map((p: Policy) => p.id));
        const nextPolicyId =
          (preferredPolicyId && availablePolicyIds.has(preferredPolicyId) && preferredPolicyId)
          || (prev.policy_id && availablePolicyIds.has(prev.policy_id) && prev.policy_id)
          || policyData?.[0]?.id
          || "";
        return { ...prev, policy_id: nextPolicyId };
      });
    } catch (err) {
      setError((err as Error).message || "Unable to load claims.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPolicies([]);
      setClaims([]);
      return;
    }
    loadAll();
  }, [authLoading, user]);

  useEffect(() => {
    const onPoliciesChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ policyId?: string | null }>;
      const preferredPolicyId = customEvent?.detail?.policyId || null;
      loadAll(preferredPolicyId);
    };

    window.addEventListener("policies:changed", onPoliciesChanged);
    return () => {
      window.removeEventListener("policies:changed", onPoliciesChanged);
    };
  }, [authLoading, user]);

  const handleCreateClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        policy_id: form.policy_id,
        claim_number: form.claim_number.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        claim_amount: Number(form.claim_amount),
        status: "pending",
        admin_notes: "",
      };

      const response = await fetch("/api/claims", {
        method: "POST",
        headers: await authHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await parseError(response));

      setForm({
        policy_id: form.policy_id,
        claim_number: "",
        title: "",
        description: "",
        claim_amount: "",
      });
      await loadAll();
    } catch (err) {
      setError((err as Error).message || "Failed to create claim.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClaim = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/claims/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!response.ok) throw new Error(await parseError(response));
      await loadAll();
    } catch (err) {
      setError((err as Error).message || "Failed to delete claim.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* New Claim Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle>Submit New Claim</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateClaim}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Policy</Label>
                <Select value={form.policy_id} onValueChange={(value) => setForm({ ...form, policy_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        {policy.policy_number} · {policy.worker_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Claim Number</Label>
                <Input
                  value={form.claim_number}
                  onChange={(e) => setForm({ ...form, claim_number: e.target.value })}
                  placeholder="CLM-0001"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Weather disruption - heavy rain"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the incident that caused the claim..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Claim Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={form.claim_amount}
                onChange={(e) => setForm({ ...form, claim_amount: e.target.value })}
                placeholder="500"
                required
              />
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <Button className="w-full" type="submit" disabled={loading || policies.length === 0}>
              {loading ? "Submitting..." : "Submit Claim"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Claims List with Fraud Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Active Claims & Fraud Analysis
          </CardTitle>
          <CardDescription>Real-time fraud detection and payout processing</CardDescription>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No claims submitted yet.</p>
          ) : (
            <div className="space-y-4">
              {claims.map((claim) => {
                const fraud = fraudAnalyses[claim.id];
                const payout = pendingPayouts[claim.id];

                return (
                  <div key={claim.id} className="p-4 border rounded-lg space-y-3">
                    {/* Claim Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg">{claim.title}</p>
                          <Badge variant="outline">{claim.claim_number}</Badge>
                          <Badge
                            className={
                              claim.status === "paid_out"
                                ? "bg-green-100 text-green-800"
                                : claim.status === "approved"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {claim.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{claim.description}</p>
                      </div>
                      <p className="text-lg font-bold text-primary">₹{claim.claim_amount}</p>
                    </div>

                    {/* Fraud Analysis */}
                    {fraud && (
                      <div
                        className={`p-3 rounded border-2 ${
                          fraud.is_fraudulent
                            ? "border-red-300 bg-red-50"
                            : "border-green-300 bg-green-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {fraud.is_fraudulent ? (
                            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p
                              className={`font-semibold ${
                                fraud.is_fraudulent ? "text-red-900" : "text-green-900"
                              }`}
                            >
                              {fraud.reason}
                            </p>
                            {fraud.flags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {fraud.flags.map((flag) => (
                                  <Badge
                                    key={flag}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span>Risk Score:</span>
                                <span className="font-bold">
                                  {(fraud.risk_score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div
                                  className={`h-2 rounded-full ${
                                    fraud.is_fraudulent
                                      ? "bg-red-600"
                                      : "bg-green-600"
                                  }`}
                                  style={{ width: `${fraud.risk_score * 100}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-xs mt-2 text-gray-700">
                              <strong>Recommendation:</strong> {fraud.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payout Status */}
                    {payout ? (
                      <div className="p-3 rounded border-2 border-green-300 bg-green-50">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          <p className="font-semibold text-green-900">
                            Payout Processed: ₹{payout.amount}
                          </p>
                        </div>
                        <p className="text-xs text-green-700 mt-1">
                          {payout.gateway.toUpperCase()} • Status: {payout.status}
                        </p>
                      </div>
                    ) : claim.status === "approved" && !fraud?.is_fraudulent ? (
                      <Button
                        onClick={() => processPayout(claim)}
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Process Instant Payout
                      </Button>
                    ) : null}

                    {/* Delete Button */}
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClaim(claim.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClaimsManagement;
