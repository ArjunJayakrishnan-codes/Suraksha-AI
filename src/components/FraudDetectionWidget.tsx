import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Check, Clock, DollarSign, Zap, Shield, TrendingDown } from "lucide-react";
import { getSupabase } from "@/integrations/supabase/client";

interface FraudAnalysis {
  is_fraudulent: boolean;
  risk_score: number;
  flags: string[];
  reason: string;
  recommendation: string;
}

interface PayoutTransaction {
  payout_id: string;
  status: string;
  amount: number;
  gateway: string;
  transaction_details: Record<string, any>;
  created_at: string;
}

const FraudDetectionWidget: React.FC<{ claim: any }> = ({ claim }) => {
  const [analysis, setAnalysis] = useState<FraudAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    analyzeClaim();
  }, [claim]);

  const analyzeClaim = async () => {
    if (!claim) return;
    
    setLoading(true);
    
    try {
      const token = await getAuthToken();
      
      const response = await fetch("/api/fraud-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          claim,
          include_history: true,
        }),
      });

      if (!response.ok) throw new Error("Fraud analysis failed");
      
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      console.error("Fraud analysis error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    const supabase = getSupabase();
    if (!supabase) return "mock-dev-token";
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      return token || "";
    } catch (e) {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 animate-spin" />
        Analyzing for fraud...
      </div>
    );
  }

  if (!analysis) return null;

  const isHighRisk = analysis.risk_score > 0.7;
  const isModerateRisk = analysis.risk_score > 0.4;

  if (analysis.is_fraudulent) {
    return (
      <Alert className={`border-2 ${isHighRisk ? "border-red-300 bg-red-50" : "border-orange-300 bg-orange-50"}`}>
        <AlertTriangle className={`h-4 w-4 ${isHighRisk ? "text-red-600" : "text-orange-600"}`} />
        <AlertDescription className={`ml-2 ${isHighRisk ? "text-red-800" : "text-orange-800"}`}>
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Fraud Risk Detected</span>
              <div className="text-xs mt-1">{analysis.reason}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {analysis.flags.map((flag) => (
                <Badge key={flag} className="text-xs" variant="secondary">
                  {flag}
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Risk: {(analysis.risk_score * 100).toFixed(0)}%</span>
              <span className="text-xs font-semibold">{analysis.recommendation}</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded border border-green-200">
      <Check className="h-4 w-4" />
      <span className="font-medium">Legitimate Claim • Low Risk ({(analysis.risk_score * 100).toFixed(0)}%)</span>
    </div>
  );
};

export default FraudDetectionWidget;
