import fs from 'fs';
import path from 'path';

(async () => {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
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

    const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const API_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !API_KEY) throw new Error('Supabase URL or API key missing in .env.local');

    const email = 'aerinuchiaga@gmail.com';
    const password = '123456';
    console.log('Signing in as', email);

    const form = new URLSearchParams();
    form.set('grant_type', 'password');
    form.set('username', email);
    form.set('password', password);

    const tokenRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    const tokenJson = await tokenRes.json().catch(() => null);
    console.log('token status', tokenRes.status);
    if (!tokenJson || !tokenJson.access_token) {
      console.error('Failed to obtain access token:', tokenJson);
      process.exit(1);
    }

    const access_token = tokenJson.access_token;
    console.log('Got access token, calling backend endpoints...');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` };

    // Create policy
    const policyPayload = {
      worker_name: 'Real Demo Worker',
      policy_number: `REAL-${Date.now()}`,
      coverage_type: 'premium',
      weekly_premium: 25.0,
      active: true,
      notes: 'Created by e2e_with_user script'
    };
    const policyRes = await fetch('http://localhost:8000/api/policies', { method: 'POST', headers, body: JSON.stringify(policyPayload) });
    const policyJson = await policyRes.json().catch(() => null);
    console.log('/api/policies create:', policyRes.status, policyJson);
    const policyId = policyJson?.id;

    // Create claim
    const claimPayload = {
      policy_id: policyId || '',
      claim_number: `CL-${Date.now()}`,
      title: 'Real Claim',
      description: 'Claim created during e2e_with_user script',
      claim_amount: 150.0
    };
    const claimRes = await fetch('http://localhost:8000/api/claims', { method: 'POST', headers, body: JSON.stringify(claimPayload) });
    const claimJson = await claimRes.json().catch(() => null);
    console.log('/api/claims create:', claimRes.status, claimJson);
    const claimId = claimJson?.id;

    // Fraud check
    const fraudRes = await fetch('http://localhost:8000/api/fraud-check', { method: 'POST', headers, body: JSON.stringify({ claim: claimJson, include_history: true }) });
    const fraudJson = await fraudRes.json().catch(() => null);
    console.log('/api/fraud-check:', fraudRes.status, fraudJson);

    // Payout
    const payoutPayload = { claim_id: claimId, amount: claimJson?.claim_amount || 0, recipient_identifier: 'worker@upi', gateway: 'upi' };
    const payoutRes = await fetch('http://localhost:8000/api/payouts', { method: 'POST', headers, body: JSON.stringify(payoutPayload) });
    const payoutJson = await payoutRes.json().catch(() => null);
    console.log('/api/payouts:', payoutRes.status, payoutJson);

    console.log('End-to-end with real user complete.');
    process.exit(0);
  } catch (err) {
    console.error('e2e_with_user error:', err);
    process.exit(1);
  }
})();
