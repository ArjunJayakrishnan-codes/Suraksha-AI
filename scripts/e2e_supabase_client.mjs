import { createClient } from '@supabase/supabase-js';
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

    const supabase = createClient(SUPABASE_URL, API_KEY, {
      auth: { persistSession: false }
    });

    const email = 'aerinuchiaga@gmail.com';
    const password = '123456';
    console.log('Signing in via @supabase/supabase-js as', email);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Sign-in error:', error);
      process.exit(1);
    }

    const access_token = data?.session?.access_token;
    if (!access_token) {
      console.error('No access token returned:', data);
      process.exit(1);
    }

    console.log('Signed in, got access token. Calling backend...');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` };

    const policyPayload = {
      worker_name: 'Real Worker',
      policy_number: `REAL-${Date.now()}`,
      coverage_type: 'standard',
      weekly_premium: 15.0,
      active: true,
      notes: 'Created by e2e_supabase_client'
    };
    const policyRes = await fetch('http://localhost:8000/api/policies', { method: 'POST', headers, body: JSON.stringify(policyPayload) });
    const policyJson = await policyRes.json().catch(() => null);
    console.log('/api/policies create:', policyRes.status, policyJson);
    const policyId = policyJson?.id;

    const claimPayload = {
      policy_id: policyId || '',
      claim_number: `CL-${Date.now()}`,
      title: 'Real Claim from supabase client',
      description: 'Claim via supabase client script',
      claim_amount: 100.0
    };
    const claimRes = await fetch('http://localhost:8000/api/claims', { method: 'POST', headers, body: JSON.stringify(claimPayload) });
    const claimJson = await claimRes.json().catch(() => null);
    console.log('/api/claims create:', claimRes.status, claimJson);
    const claimId = claimJson?.id;

    const fraudRes = await fetch('http://localhost:8000/api/fraud-check', { method: 'POST', headers, body: JSON.stringify({ claim: claimJson, include_history: true }) });
    const fraudJson = await fraudRes.json().catch(() => null);
    console.log('/api/fraud-check:', fraudRes.status, fraudJson);

    const payoutPayload = { claim_id: claimId, amount: claimJson?.claim_amount || 0, recipient_identifier: 'worker@upi', gateway: 'upi' };
    const payoutRes = await fetch('http://localhost:8000/api/payouts', { method: 'POST', headers, body: JSON.stringify(payoutPayload) });
    const payoutJson = await payoutRes.json().catch(() => null);
    console.log('/api/payouts:', payoutRes.status, payoutJson);

    console.log('E2E via supabase client complete.');
    process.exit(0);
  } catch (err) {
    console.error('e2e_supabase_client error:', err);
    process.exit(1);
  }
})();
