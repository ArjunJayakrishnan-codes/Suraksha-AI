import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Shield,
  Loader2,
  Search,
  FileText,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";

interface Worker {
  worker_id: string;
  name: string;
  policies: Array<{
    id: string;
    policy_number: string;
    coverage_type: string;
    weekly_premium: number;
    active: boolean;
  }>;
  claims: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    paid_out: number;
  };
  claim_amount: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  high_risk_flags: Array<{
    claim_id: string;
    risk_score: number;
    reason: string;
  }>;
  created_at: string;
  last_activity?: string;
}

interface WorkerDetails {
  worker_id: string;
  worker_name: string;
  created_at?: string;
  last_activity?: string;
  policies: any[];
  policy_count: number;
  active_policies: number;
  claims: Array<{
    id: string;
    policy_id: string;
    claim_number: string;
    title: string;
    description: string;
    claim_amount: number;
    status: string;
    created_at: string;
    admin_notes: string;
    fraud_analysis: {
      risk_score: number;
      is_high_risk: boolean;
      reason: string;
      flags: string[];
    };
  }>;
  claims_summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    paid_out: number;
  };
  claim_amounts: {
    total: number;
    approved: number;
    pending: number;
  };
  high_risk_claims: number;
  payouts_summary?: {
    total: number;
    success: number;
    in_flight: number;
    total_paid: number;
  };
  recent_payouts?: Array<{
    payout_id: string;
    status: string;
    gateway: string;
    amount: number;
    created_at: string;
    claim_id?: string;
  }>;
}

const AdminWorkerManagement = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerDetails | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    worker_name: "",
    policy_number: "",
    coverage_type: "Basic Coverage",
    weekly_premium: "45",
    notes: "",
  });

  // Fetch all workers
  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch("/api/admin/workers");
      if (response.ok) {
        const data = await response.json();
        setWorkers(data.workers || []);
      }
    } catch (e) {
      console.error("Error fetching workers:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkerDetails = async (workerId: string) => {
    try {
      const response = await authenticatedFetch(`/api/admin/workers/${workerId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedWorker(data);
        setSelectedClaim(null);
      }
    } catch (e) {
      console.error("Error fetching worker details:", e);
    }
  };

  const handleApproveClaim = async (claimId: string) => {
    if (!selectedClaim) return;
    try {
      setApproving(true);
      const response = await authenticatedFetch(`/api/admin/claims/${claimId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          admin_notes: adminNotes,
        }),
      });

      if (response.ok) {
        // Refresh worker details
        if (selectedWorker) {
          await fetchWorkerDetails(selectedWorker.worker_id);
        }
        setAdminNotes("");
        alert("Claim approved successfully!");
      }
    } catch (e) {
      console.error("Error approving claim:", e);
      alert("Failed to approve claim");
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
        // Refresh worker details
        if (selectedWorker) {
          await fetchWorkerDetails(selectedWorker.worker_id);
        }
        setRejectionReason("");
        alert("Claim rejected successfully!");
      }
    } catch (e) {
      console.error("Error rejecting claim:", e);
      alert("Failed to reject claim");
    } finally {
      setRejecting(false);
    }
  };

  const handleCreatePolicy = async () => {
    if (!selectedWorker) {
      alert("Please select a worker first");
      return;
    }
    if (!policyForm.policy_number.trim()) {
      alert("Please enter a policy number");
      return;
    }

    try {
      setCreatingPolicy(true);
      const response = await authenticatedFetch(
        `/api/admin/policies/${selectedWorker.worker_id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            worker_name: policyForm.worker_name || selectedWorker.worker_name,
            policy_number: policyForm.policy_number,
            coverage_type: policyForm.coverage_type,
            weekly_premium: parseFloat(policyForm.weekly_premium),
            active: true,
            notes: policyForm.notes,
          }),
        }
      );

      if (response.ok) {
        // Refresh worker details
        await fetchWorkerDetails(selectedWorker.worker_id);
        // Reset form and close modal
        setPolicyForm({
          worker_name: "",
          policy_number: "",
          coverage_type: "Basic Coverage",
          weekly_premium: "45",
          notes: "",
        });
        setShowCreatePolicy(false);
        alert("Policy created successfully!");
      } else {
        const errorData = await response.json();
        alert(`Failed to create policy: ${errorData.detail || "Unknown error"}`);
      }
    } catch (e) {
      console.error("Error creating policy:", e);
      alert("Failed to create policy");
    } finally {
      setCreatingPolicy(false);
    }
  };

  const filteredWorkers = workers.filter(
    (w) =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.worker_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);

  const formatDateTime = (value?: string) => {
    if (!value) return "N/A";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "N/A";
    return dt.toLocaleString();
  };

  if (loading && workers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-400" />
            Worker Policy & Claims Management
          </CardTitle>
          <CardDescription className="text-slate-400">
            Review all workers' policies and claims with approval/rejection workflow
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workers List */}
        <div className="lg:col-span-1">
          <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Workers ({filteredWorkers.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search workers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400"
                />
              </div>

              {/* Workers List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredWorkers.map((worker) => (
                  <button
                    key={worker.worker_id}
                    onClick={() => fetchWorkerDetails(worker.worker_id)}
                    className={`w-full p-3 rounded-lg border transition-all text-left text-sm ${
                      selectedWorker?.worker_id === worker.worker_id
                        ? "border-blue-500/50 bg-blue-600/20"
                        : "border-slate-600 bg-slate-700/30 hover:bg-slate-700/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="font-semibold text-white">{worker.name}</p>
                        <p className="text-xs text-slate-400">ID: {worker.worker_id.slice(0, 10)}... | {worker.policies.length} policies</p>
                      </div>
                      {worker.high_risk_flags.length > 0 && (
                        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {worker.claims.pending} Pending
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        ₹{formatMoney(worker.claim_amount.pending)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {worker.claims.paid_out} Paid
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Worker Details / Claim Details */}
        {selectedWorker ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Worker Summary */}
            <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
              <CardHeader>
                <CardTitle className="text-white">{selectedWorker.worker_name}</CardTitle>
                <CardDescription className="text-slate-400">
                  Worker ID: {selectedWorker.worker_id} | {selectedWorker.policy_count} policies | {selectedWorker.claims_summary.total} claims
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-slate-600 bg-slate-700/30">
                    <p className="text-slate-400">Member Since</p>
                    <p className="text-slate-200 mt-1">{formatDateTime(selectedWorker.created_at)}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-600 bg-slate-700/30">
                    <p className="text-slate-400">Last Activity</p>
                    <p className="text-slate-200 mt-1">{formatDateTime(selectedWorker.last_activity)}</p>
                  </div>
                </div>

                {/* Policies / Claims / Payout Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                    <p className="text-xs text-slate-400">Active Policies</p>
                    <p className="text-2xl font-bold text-cyan-300 mt-1">{selectedWorker.active_policies}</p>
                  </div>
                  <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                    <p className="text-xs text-slate-400">Total Claim Value</p>
                    <p className="text-2xl font-bold text-green-300 mt-1">₹{formatMoney(selectedWorker.claim_amounts.total)}</p>
                  </div>
                  <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                    <p className="text-xs text-slate-400">High Risk Claims</p>
                    <p className="text-2xl font-bold text-rose-300 mt-1">{selectedWorker.high_risk_claims}</p>
                  </div>
                  <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                    <p className="text-xs text-slate-400">Total Paid Out</p>
                    <p className="text-2xl font-bold text-emerald-300 mt-1">₹{formatMoney(selectedWorker.payouts_summary?.total_paid || 0)}</p>
                  </div>
                </div>

                {/* Claims Status Breakdown */}
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="p-2 bg-yellow-600/20 rounded border border-yellow-500/30">
                    <p className="text-yellow-300 font-bold">{selectedWorker.claims_summary.pending}</p>
                    <p className="text-xs text-yellow-200">Pending</p>
                  </div>
                  <div className="p-2 bg-emerald-600/20 rounded border border-emerald-500/30">
                    <p className="text-emerald-300 font-bold">{selectedWorker.claims_summary.approved}</p>
                    <p className="text-xs text-emerald-200">Approved</p>
                  </div>
                  <div className="p-2 bg-red-600/20 rounded border border-red-500/30">
                    <p className="text-red-300 font-bold">{selectedWorker.claims_summary.rejected}</p>
                    <p className="text-xs text-red-200">Rejected</p>
                  </div>
                  <div className="p-2 bg-cyan-600/20 rounded border border-cyan-500/30">
                    <p className="text-cyan-300 font-bold">{selectedWorker.claims_summary.paid_out}</p>
                    <p className="text-xs text-cyan-200">Paid Out</p>
                  </div>
                </div>

                {/* High Risk Warning */}
                {selectedWorker.high_risk_claims > 0 && (
                  <Alert className="bg-red-600/20 border-red-500/30">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-red-300">
                      {selectedWorker.high_risk_claims} high-risk claim(s) detected by fraud analysis
                    </AlertDescription>
                  </Alert>
                )}

                {/* Policies List */}
                {selectedWorker.policies.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">Policies</h4>
                    <div className="space-y-2 xl:col-span-2">
                      {selectedWorker.policies.map((policy) => (
                        <div
                          key={policy.id}
                          className="p-2 bg-slate-700/30 rounded border border-slate-600 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">{policy.policy_number}</span>
                            <Badge
                              variant={policy.active ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {policy.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {policy.coverage_type} • ₹{policy.weekly_premium}/week
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedWorker.recent_payouts && selectedWorker.recent_payouts.length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-300" />
                      Recent Payouts
                    </h4>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedWorker.recent_payouts.map((payout) => (
                        <div key={payout.payout_id} className="p-2 bg-slate-700/30 rounded border border-slate-600 text-xs">
                          <div className="flex justify-between items-center gap-2">
                            <p className="text-slate-200 font-medium truncate">{payout.payout_id}</p>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {payout.status}
                            </Badge>
                          </div>
                          <p className="text-slate-400 mt-1">
                            ₹{formatMoney(payout.amount)} via {payout.gateway.toUpperCase()} | {formatDateTime(payout.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create Policy Button */}
                <Button
                  onClick={() => setShowCreatePolicy(true)}
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
                >
                  + Create New Policy for Worker
                </Button>
              </CardContent>
            </Card>

            {/* Claims List */}
            <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
              <CardHeader>
                <CardTitle className="text-white text-lg">Claims</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {selectedWorker.claims.length === 0 ? (
                  <p className="text-slate-400 text-sm">No claims for this worker</p>
                ) : (
                  selectedWorker.claims.map((claim) => (
                    <button
                      key={claim.id}
                      onClick={() => setSelectedClaim(claim)}
                      className={`w-full p-3 rounded-lg border transition-all text-left text-sm ${
                        selectedClaim?.id === claim.id
                          ? "border-blue-500/50 bg-blue-600/20"
                          : "border-slate-600 bg-slate-700/30 hover:bg-slate-700/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{claim.title}</p>
                          <p className="text-xs text-slate-400">
                            ₹{formatMoney(claim.claim_amount)} | {claim.policy_id} | {formatDateTime(claim.created_at)}
                          </p>
                        </div>
                        <Badge
                          className={`text-xs flex-shrink-0 ${
                            claim.status === "pending"
                              ? "bg-yellow-600/50 text-yellow-300"
                              : claim.status === "approved"
                              ? "bg-emerald-600/50 text-emerald-300"
                              : claim.status === "rejected"
                              ? "bg-red-600/50 text-red-300"
                              : "bg-cyan-600/50 text-cyan-300"
                          }`}
                        >
                          {claim.status}
                        </Badge>
                      </div>
                      {claim.fraud_analysis.is_high_risk && (
                        <div className="flex items-center gap-1 mt-2 text-red-300 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          Risk: {(claim.fraud_analysis.risk_score * 100).toFixed(0)}%
                        </div>
                      )}
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center">
            <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 h-96 flex items-center justify-center w-full">
              <p className="text-slate-400 text-center">Select a worker to view details</p>
            </Card>
          </div>
        )}
      </div>

      {/* Claim Details & Action Panel */}
      {selectedClaim && selectedWorker && (
        <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
          <CardHeader>
            <CardTitle className="text-white">{selectedClaim.title}</CardTitle>
            <CardDescription className="text-slate-400">
              Claim #{selectedClaim.claim_number} • Amount: ₹{selectedClaim.claim_amount}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Description */}
            <div>
              <p className="text-sm font-semibold text-slate-300 mb-2">Description</p>
              <p className="text-sm text-slate-400">{selectedClaim.description}</p>
            </div>

            {/* Fraud Analysis */}
            <Alert
              className={`border-0 ${
                selectedClaim.fraud_analysis.is_high_risk
                  ? "bg-red-600/20 text-red-300"
                  : "bg-emerald-600/20 text-emerald-300"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Fraud Risk Score:</strong> {(selectedClaim.fraud_analysis.risk_score * 100).toFixed(1)}%
                {selectedClaim.fraud_analysis.is_high_risk && " - HIGH RISK"}
              </AlertDescription>
            </Alert>

            {/* Fraud Flags */}
            {selectedClaim.fraud_analysis.flags.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-300 mb-2">🚩 Fraud Indicators:</p>
                <div className="space-y-1">
                  {selectedClaim.fraud_analysis.flags.map((flag, i) => (
                    <p key={i} className="text-sm text-slate-400">
                      • {flag}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Actions (only for pending claims) */}
            {selectedClaim.status === "pending" && (
              <div className="space-y-3 pt-4 border-t border-slate-600">
                <div>
                  <label className="text-sm font-semibold text-slate-300 block mb-2">
                    Admin Notes (optional)
                  </label>
                  <Textarea
                    placeholder="Add notes for your approval decision..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full p-2 rounded bg-slate-700/50 border border-slate-600 text-sm text-slate-100 placeholder-slate-400"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApproveClaim(selectedClaim.id)}
                    disabled={approving}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0"
                  >
                    {approving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve Claim
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-semibold text-red-300 block mb-2">
                    Rejection Reason (required if rejecting)
                  </label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this claim is being rejected..."
                    className="w-full p-2 rounded bg-slate-700/50 border border-red-500/30 text-sm text-slate-100 placeholder-slate-400"
                    rows={2}
                  />
                </div>

                <Button
                  onClick={() => handleRejectClaim(selectedClaim.id)}
                  disabled={rejecting || !rejectionReason.trim()}
                  variant="outline"
                  className="w-full border-red-500/30 text-red-300 hover:bg-red-600/20"
                >
                  {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Reject Claim
                </Button>
              </div>
            )}

            {/* Already processed status */}
            {selectedClaim.status !== "pending" && (
              <Alert className="bg-slate-700/50 border-slate-600">
                <FileText className="h-4 w-4 text-slate-400" />
                <AlertDescription className="text-slate-300">
                  This claim has already been {selectedClaim.status}. {selectedClaim.admin_notes && `Notes: ${selectedClaim.admin_notes}`}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Policy Modal */}
      {showCreatePolicy && selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-white">Create Policy for {selectedWorker.worker_name}</CardTitle>
              <CardDescription className="text-slate-400">
                Enroll this worker in a new insurance policy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-2">
                  Policy Number
                </label>
                <Input
                  value={policyForm.policy_number}
                  onChange={(e) => setPolicyForm({ ...policyForm, policy_number: e.target.value })}
                  placeholder="POL-2024-001"
                  className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-2">
                  Coverage Type
                </label>
                <select
                  value={policyForm.coverage_type}
                  onChange={(e) => setPolicyForm({ ...policyForm, coverage_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-slate-100"
                >
                  <option value="Basic Coverage">Basic Coverage</option>
                  <option value="Standard Coverage">Standard Coverage</option>
                  <option value="Extended Coverage">Extended Coverage</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-2">
                  Weekly Premium (₹)
                </label>
                <Input
                  type="number"
                  value={policyForm.weekly_premium}
                  onChange={(e) => setPolicyForm({ ...policyForm, weekly_premium: e.target.value })}
                  placeholder="45"
                  className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-2">
                  Notes (optional)
                </label>
                <Textarea
                  value={policyForm.notes}
                  onChange={(e) => setPolicyForm({ ...policyForm, notes: e.target.value })}
                  placeholder="Any special notes for this policy..."
                  className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreatePolicy}
                  disabled={creatingPolicy}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0"
                >
                  {creatingPolicy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {creatingPolicy ? "Creating..." : "Create Policy"}
                </Button>
                <Button
                  onClick={() => setShowCreatePolicy(false)}
                  disabled={creatingPolicy}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/50"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminWorkerManagement;
