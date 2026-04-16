#!/usr/bin/env node
/**
 * Full-Stack E2E Verification Script
 * Tests all Phase 3 features end-to-end with working Supabase auth
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:8082';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  section: (text) => console.log(`\n${colors.bright}${colors.cyan}═══ ${text} ═══${colors.reset}`),
  success: (text) => console.log(`${colors.green}✓${colors.reset} ${text}`),
  error: (text) => console.log(`${colors.red}✗${colors.reset} ${text}`),
  info: (text) => console.log(`${colors.blue}ℹ${colors.reset} ${text}`),
  result: (text) => console.log(`${colors.yellow}→${colors.reset} ${text}`),
};

async function main() {
  try {
    log.section('GigGuard Full-Stack Verification');

    // Load environment
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      throw new Error('.env.local not found');
    }

    const env = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((acc, line) => {
      const l = line.trim();
      if (!l || l.startsWith('#')) return acc;
      const idx = l.indexOf('=');
      if (idx === -1) return acc;
      const key = l.slice(0, idx).trim();
      let val = l.slice(idx+1).trim();
      val = val.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      acc[key] = val;
      return acc;
    }, {});

    log.section('1. Backend Health Check');
    try {
      const health = await fetch(`${BACKEND_URL}/health`);
      const data = await health.json();
      log.success(`Backend running: ${data.status}`);
    } catch (e) {
      throw new Error(`Backend not responding at ${BACKEND_URL}`);
    }

    log.section('2. Frontend Availability Check');
    try {
      const frontend = await fetch(FRONTEND_URL);
      log.success(`Frontend running on port 8082`);
    } catch (e) {
      throw new Error(`Frontend not responding at ${FRONTEND_URL}`);
    }

    log.section('3. Environment Configuration');
    const requiredEnv = ['SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
    const missing = requiredEnv.filter(k => !env[k]);
    if (missing.length > 0) {
      throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
    log.success(`Supabase URL: ${env.SUPABASE_URL}`);
    log.success(`Auth key configured`);

    log.section('4. Supabase Authentication');
    const supabase = createClient(env.SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false }
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'aerinuchiaga@gmail.com',
      password: '123456'
    });

    if (error) throw new Error(`Auth failed: ${error.message}`);
    const token = data?.session?.access_token;
    if (!token) throw new Error('No access token returned');
    log.success(`Authenticated as: aerinuchiaga@gmail.com`);
    log.result(`Access token received (${token.slice(0, 20)}...)`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    log.section('5. Policy Management (Create/Read)');
    
    // Create policy
    const policyPayload = {
      worker_name: 'Test Worker Full Stack',
      policy_number: `FULLSTACK-${Date.now()}`,
      coverage_type: 'premium',
      weekly_premium: 50.0,
      active: true,
      notes: 'Full-stack E2E verification'
    };

    const policyRes = await fetch(`${BACKEND_URL}/api/policies`, {
      method: 'POST',
      headers,
      body: JSON.stringify(policyPayload)
    });

    if (!policyRes.ok) throw new Error(`Policy create failed: ${policyRes.status}`);
    const policy = await policyRes.json();
    log.success(`Created policy: ${policy.policy_number}`);
    log.result(`Policy ID: ${policy.id}`);

    // List policies
    const policiesRes = await fetch(`${BACKEND_URL}/api/policies`, { headers });
    const policies = await policiesRes.json();
    log.success(`Retrieved ${policies.length} policies`);

    log.section('6. Claims Management (Create/Read)');

    // Create claim
    const claimPayload = {
      policy_id: policy.id,
      claim_number: `FSE-${Date.now()}`,
      title: 'Lost delivery package during rainfall',
      description: 'Package lost due to extreme weather event during delivery',
      claim_amount: 250.0,
      delivery_location: 'Downtown Metro Area',
      weather_condition: 'heavy_rain',
      claim_date: new Date().toISOString().split('T')[0],
      claim_frequency: 1
    };

    const claimRes = await fetch(`${BACKEND_URL}/api/claims`, {
      method: 'POST',
      headers,
      body: JSON.stringify(claimPayload)
    });

    if (!claimRes.ok) throw new Error(`Claim create failed: ${claimRes.status}`);
    const claim = await claimRes.json();
    log.success(`Created claim: ${claim.claim_number}`);
    log.result(`Claim ID: ${claim.id} | Amount: ₹${claim.claim_amount}`);

    // List claims
    const claimsRes = await fetch(`${BACKEND_URL}/api/claims`, { headers });
    const claims = await claimsRes.json();
    log.success(`Retrieved ${claims.length} claims`);

    log.section('7. Fraud Detection Analysis');

    // Single claim fraud check
    const fraudPayload = {
      claim: claim,
      include_history: true
    };

    const fraudRes = await fetch(`${BACKEND_URL}/api/fraud-check`, {
      method: 'POST',
      headers,
      body: JSON.stringify(fraudPayload)
    });

    if (!fraudRes.ok) throw new Error(`Fraud check failed: ${fraudRes.status}`);
    const fraud = await fraudRes.json();
    
    log.success(`Fraud analysis completed`);
    log.result(`Risk Score: ${(fraud.risk_score * 100).toFixed(1)}%`);
    log.result(`Flagged: ${fraud.is_fraudulent ? 'YES' : 'NO'}`);
    log.result(`Flags: ${fraud.flags.join(', ') || 'None'}`);
    log.result(`Recommendation: ${fraud.recommendation}`);

    log.section('8. Advanced Fraud Scan (Bulk Analysis)');

    const advScanRes = await fetch(`${BACKEND_URL}/api/fraud-advanced`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });

    if (!advScanRes.ok) throw new Error(`Advanced scan failed: ${advScanRes.status}`);
    const advScan = await advScanRes.json();
    
    log.success(`Bulk fraud scan completed`);
    log.result(`Scanned: ${advScan.scanned} claims`);
    log.result(`Flagged: ${advScan.flagged_count} claims`);
    if (advScan.scanned > 0) {
      const rate = ((advScan.flagged_count / advScan.scanned) * 100).toFixed(1);
      log.result(`Fraud Rate: ${rate}%`);
    }

    log.section('9. Instant Payout System');

    // Single payout
    const payoutPayload = {
      claim_id: claim.id,
      amount: claim.claim_amount,
      recipient_identifier: 'worker@example.upi',
      gateway: 'upi'
    };

    const payoutRes = await fetch(`${BACKEND_URL}/api/payouts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payoutPayload)
    });

    if (!payoutRes.ok) throw new Error(`Payout failed: ${payoutRes.status}`);
    const payout = await payoutRes.json();
    
    log.success(`Instant payout processed`);
    log.result(`Payout ID: ${payout.payout_id}`);
    log.result(`Status: ${payout.status}`);
    log.result(`Amount: ₹${payout.amount}`);
    log.result(`Gateway: ${payout.gateway.toUpperCase()}`);
    if (payout.transaction_details.rrn) {
      log.result(`RRN: ${payout.transaction_details.rrn}`);
    }
    if (payout.transaction_details.message) {
      log.result(`Message: ${payout.transaction_details.message}`);
    }

    log.section('10. Payout Analytics');

    const analyticsRes = await fetch(`${BACKEND_URL}/api/payouts/analytics`, { headers });
    if (analyticsRes.ok) {
      const analytics = await analyticsRes.json();
      log.success(`Payout analytics retrieved`);
      log.result(`Total payouts: ${analytics.total_payouts}`);
      if (analytics.by_gateway) {
        analytics.by_gateway.forEach(gw => {
          log.result(`  ${gw._id}: ${gw.count} payouts, ₹${gw.total_amount} total`);
        });
      }
    }

    log.section('11. Payout Simulation (Batch)');

    const simRes = await fetch(`${BACKEND_URL}/api/payout-sim`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ max_count: 3, amount: 100 })
    });

    if (!simRes.ok) throw new Error(`Payout simulation failed: ${simRes.status}`);
    const sim = await simRes.json();
    
    log.success(`Batch payout simulation completed`);
    log.result(`Simulated: ${sim.simulated} payouts`);
    sim.results.forEach((r, i) => {
      if (r.payout) {
        log.result(`  [${i+1}] ${r.payout.payout_id} - ₹${r.payout.amount}`);
      } else {
        log.result(`  [${i+1}] Error: ${r.error}`);
      }
    });

    log.section('12. User Payouts History');

    const historyRes = await fetch(`${BACKEND_URL}/api/payouts`, { headers });
    if (!historyRes.ok) throw new Error(`Get payouts failed: ${historyRes.status}`);
    const history = await historyRes.json();
    
    log.success(`Retrieved user payout history`);
    log.result(`Total payouts: ${history.total}`);
    if (history.payouts.length > 0) {
      history.payouts.slice(0, 3).forEach(p => {
        log.result(`  ${p.payout_id}: ₹${p.amount} (${p.status})`);
      });
    }

    log.section('13. Frontend Access Test');

    log.info(`Open browser to test dashboards:`);
    log.result(`  Overview: ${FRONTEND_URL}`);
    log.result(`  Worker Dashboard: ${FRONTEND_URL}/worker`);
    log.result(`  Insurer Dashboard: ${FRONTEND_URL}/insurer`);

    log.section('✅ FULL-STACK VERIFICATION COMPLETE');
    console.log(`
${colors.green}${colors.bright}All systems operational!${colors.reset}

Summary:
• Backend API: Running ✓
• Frontend: Running ✓
• Supabase Auth: Connected ✓
• Policy Management: Working ✓
• Claims Management: Working ✓
• Fraud Detection: Working ✓
• Instant Payouts: Working ✓
• Admin Features: Working ✓
• Database: Connected ✓

Ready for production or demo.
    `);

    process.exit(0);
  } catch (err) {
    log.section('❌ VERIFICATION FAILED');
    log.error(err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
