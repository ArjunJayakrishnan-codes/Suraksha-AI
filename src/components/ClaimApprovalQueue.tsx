import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, XCircle, Loader2, Shield } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";

interface Claim {
  id: string;
  title: string;
  description: string;
  claim_amount: number;
  status: string;
  owner_id?: string;
  created_at: string;
  admin_notes?: string;
}

interface FraudAnalysis {
  claim_id: string;
  is_fraudulent: boolean;
  risk_score: number;
  fraud_flags: string[];
  fraud_reason: string;
  recommendation: string;
  worker_history: {
    worker_id: string;
    total_claims: number;
    pending_claims: number;
    approved_claims: number;
    rejected_claims: number;
  };
  claim_details: any;
}

interface ApprovalQueue {
  total_claims: number;
  by_status: {
    pending: Claim[];
    approved: Claim[];
    rejected: Claim[];
    paid_out: Claim[];
  };
}

export default function ClaimApprovalQueue() {
  const [queue, setQueue] = useState<ApprovalQueue | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, FraudAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<FraudAnalysis | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchApprovalQueue();
  }, []);

  const fetchApprovalQueue = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch("/api/admin/claims");
      if (response.ok) {
        const data = await response.json();
        setQueue(data);
        // Pre-analyze all pending claims
        data.by_status.pending.forEach((claim: Claim) => {
          analyzeClaim(claim.id);
        });
      }
    } catch (e) {
      console.error("Error fetching approval queue:", e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeClaim = async (claimId: string) => {
    try {
      const response = await authenticatedFetch(`/api/admin/claims/${claimId}/analyze-fraud`, {
        method: "POST",
      });
      if (response.ok) {
        const analysis = await response.json();
        setAnalyses((prev) => ({ ...prev, [claimId]: analysis }));
      }
    } catch (e) {
      console.error(`Error analyzing claim ${claimId}:`, e);
    }
  };

  const handleApproveClaim = async (claimId: string, notes: string) => {
    try {
      setApproving(true);
      const response = await authenticatedFetch(`/api/admin/claims/${claimId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          admin_notes: notes,
        }),
      });

      if (response.ok) {
        // Refresh queue
        await fetchApprovalQueue();
        setSelectedClaim(null);
        setSelectedAnalysis(null);
      }
    } catch (e) {
      console.error("Error approving claim:", e);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    try {
      setRejecting(true);
      const response = await authenticatedFetch(`/api/admin/claims/${claimId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rejectionReason,
        }),
      });

      if (response.ok) {
        // Refresh queue
        await fetchApprovalQueue();
        setSelectedClaim(null);
        setSelectedAnalysis(null);
        setRejectionReason("");
      }
    } catch (e) {
      console.error("Error rejecting claim:", e);
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const pendingClaims = queue?.by_status.pending || [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-400" />
            Claim Approval Queue
          </CardTitle>
          <CardDescription className="text-slate-400">
            Review pending claims with AI fraud analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-yellow-600/20 rounded-lg border border-yellow-500/30">
              <p className="text-xs text-yellow-300 font-bold">PENDING</p>
              <p className="text-3xl font-bold text-yellow-300 mt-1">{pendingClaims.length}</p>
            </div>
            <div className="p-3 bg-emerald-600/20 rounded-lg border border-emerald-500/30">
              <p className="text-xs text-emerald-300 font-bold">APPROVED</p>
              <p className="text-3xl font-bold text-emerald-300 mt-1">{queue?.by_status.approved.length || 0}</p>
            </div>
            <div className="p-3 bg-red-600/20 rounded-lg border border-red-500/30">
              <p className="text-xs text-red-300 font-bold">REJECTED</p>
              <p className="text-3xl font-bold text-red-300 mt-1">{queue?.by_status.rejected.length || 0}</p>
            </div>
            <div className="p-3 bg-cyan-600/20 rounded-lg border border-cyan-500/30">
              <p className="text-xs text-cyan-300 font-bold">PAID OUT</p>
              <p className="text-3xl font-bold text-cyan-300 mt-1">{queue?.by_status.paid_out.length || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Claims List */}
      {pendingClaims.length === 0 ? (
        <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold">All claims are approved!</p>
          <p className="text-slate-400 text-sm mt-1">No pending claims requiring review</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Claims List */}
          <div className="lg:col-span-1">
            <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
              <CardHeader>
                <CardTitle className="text-white">Pending Claims ({pendingClaims.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {pendingClaims.map((claim) => {
                  const analysis = analyses[claim.id];
                  const isHighRisk = analysis?.risk_score && analysis.risk_score > 0.4;

                  return (
                    <button
                      key={claim.id}
                      onClick={() => {
                        setSelectedClaim(claim);
                        setSelectedAnalysis(analysis || null);
                      }}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        selectedClaim?.id === claim.id
                          ? "border-blue-500/50 bg-blue-600/20"
                          : "border-slate-600 bg-slate-700/30 hover:bg-slate-700/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate text-sm">{claim.title}</p>
                          <p className="text-xs text-slate-400 truncate">₹{claim.claim_amount}</p>
                        </div>
                        {isHighRisk && (
                          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Fraud Analysis & Approval */}
          {selectedClaim && selectedAnalysis ? (
            <div className="lg:col-span-2">
              <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
                <CardHeader>
                  <CardTitle className="text-white">{selectedClaim.title}</CardTitle>
                  <CardDescription className="text-slate-400">
                    Claim Amount: ₹{selectedClaim.claim_amount}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Fraud Score */}
                  <Alert className={`border-0 ${
                    selectedAnalysis.is_fraudulent
                      ? "bg-red-600/20 text-red-300"
                      : "bg-emerald-600/20 text-emerald-300"
                  }`}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Fraud Risk Score:</strong> {(selectedAnalysis.risk_score * 100).toFixed(1)}%
                      {selectedAnalysis.is_fraudulent && " - HIGH RISK"}
                    </AlertDescription>
                  </Alert>

                  {/* Fraud Flags */}
                  {selectedAnalysis.fraud_flags.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-300 mb-2">🚩 Fraud Indicators:</p>
                      <div className="space-y-1">
                        {selectedAnalysis.fraud_flags.map((flag, i) => (
                          <p key={i} className="text-sm text-slate-400">• {flag}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Recommendation */}
                  <div className="p-3 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-lg border border-blue-500/30">
                    <p className="text-sm font-semibold text-blue-300 mb-1">🤖 AI Recommendation:</p>
                    <p className="text-sm text-slate-300">{selectedAnalysis.recommendation}</p>
                  </div>

                  {/* Worker History */}
                  <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                    <p className="text-sm font-semibold text-slate-300 mb-2">📊 Worker History:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-400">Total Claims</p>
                        <p className="font-bold text-cyan-300">{selectedAnalysis.worker_history.total_claims}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Approved</p>
                        <p className="font-bold text-emerald-300">{selectedAnalysis.worker_history.approved_claims}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Pending</p>
                        <p className="font-bold text-yellow-300">{selectedAnalysis.worker_history.pending_claims}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Rejected</p>
                        <p className="font-bold text-red-300">{selectedAnalysis.worker_history.rejected_claims}</p>
                      </div>
                    </div>
                  </div>

                  {/* Approval Actions */}
                  <div className="space-y-3 pt-4 border-t border-slate-600">
                    <div>
                      <label className="text-sm font-semibold text-slate-300 block mb-2">
                        Admin Notes (optional)
                      </label>
                      <textarea
                        placeholder="Add notes for your approval decision..."
                        className="w-full p-2 rounded bg-slate-700/50 border border-slate-600 text-sm text-slate-100 placeholder-slate-400"
                        rows={2}
                        defaultValue={selectedAnalysis.fraud_reason}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          const notes = (document.querySelector('textarea') as HTMLTextAreaElement)?.value || "";
                          handleApproveClaim(selectedClaim.id, notes);
                        }}
                        disabled={approving}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0"
                      >
                        {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Approve Claim
                      </Button>
                      <Button
                        onClick={() => {
                          if (!rejectionReason) {
                            alert("Please provide a rejection reason in the field below");
                            return;
                          }
                          handleRejectClaim(selectedClaim.id);
                        }}
                        disabled={rejecting}
                        variant="outline"
                        className="flex-1 border-red-500/30 text-red-300 hover:bg-red-600/20"
                      >
                        {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Reject Claim
                      </Button>
                    </div>

                    {/* Rejection Reason */}
                    <div>
                      <label className="text-sm font-semibold text-red-300 block mb-2">
                        Rejection Reason (required if rejecting)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why this claim is being rejected..."
                        className="w-full p-2 rounded bg-slate-700/50 border border-red-500/30 text-sm text-slate-100 placeholder-slate-400"
                        rows={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="lg:col-span-2 border-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center h-96">
              <p className="text-slate-400 text-center">
                {selectedClaim ? "Loading analysis..." : "Select a claim to review"}
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
