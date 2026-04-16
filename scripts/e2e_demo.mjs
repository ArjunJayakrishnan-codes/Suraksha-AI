import fs from 'fs';
import path from 'path';

function loadEnv(file) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) throw new Error(`Env file not found: ${p}`);
  const txt = fs.readFileSync(p, 'utf8');
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    const [k, ...rest] = l.split('=');
    if (!k) continue;
    let v = rest.join('=').trim();
    v = v.replace(/^"|"$/g, '');
    v = v.replace(/^'|'$/g, '');
    out[k.trim()] = v;
  }
  return out;
}

(async () => {
  try {
    const env = loadEnv('.env.local');
    const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const API_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !API_KEY) {
      console.error('Missing SUPABASE_URL or API key in .env.local');
      process.exit(1);
    }

    const email = `e2e${Date.now()}@example.com`;
    const password = 'E2eDemoPass!234';
    console.log('Signing up demo user:', email);

    const signupRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const signupJson = await signupRes.text();
    let signup;
    try { signup = JSON.parse(signupJson); } catch (e) { signup = { raw: signupJson }; }
    console.log('Signup response:', signupRes.status, signup);

    // Try to obtain access token via token endpoint (password grant)
    console.log('Requesting token via /auth/v1/token (password grant)');
    const form = new URLSearchParams();
    form.set('grant_type', 'password');
    form.set('username', email);
    form.set('password', password);

    const tokenRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const tokenJson = await tokenRes.json().catch(() => null);
    console.log('Token response status:', tokenRes.status, tokenJson);

    let access_token = tokenJson?.access_token || tokenJson?.accessToken || tokenJson?.access_token || null;

    // If token not obtained, try using service role key to create user via admin API
    if (!access_token) {
      console.log('No token from password grant. Attempting to create user via admin API (service role key).');
      const SERVICE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET;
      if (!SERVICE_KEY) {
        console.error('No service role key found in .env.local. Cannot create user programmatically. Exiting.');
        process.exit(1);
      }

      // Create user via admin endpoint
      const adminRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, user_metadata: { created_by: 'e2e-script' }, email_confirm: true }),
      });

      const adminJson = await adminRes.json().catch(() => null);
      console.log('Admin create user:', adminRes.status, adminJson);

      if (adminRes.status >= 200 && adminRes.status < 300) {
        // Request token again via password grant
        const tokenRes2 = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            apikey: API_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        });
        const tokenJson2 = await tokenRes2.json().catch(() => null);
        access_token = tokenJson2?.access_token || null;
        console.log('Token after admin create:', tokenRes2.status, tokenJson2 ? '[json]' : '[no json]');
      } else {
        console.error('Admin user creation failed; cannot continue.');
        process.exit(1);
      }
    }

    console.log('Access token acquired. Running API calls...');

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` };

    // Create a policy
    const policyPayload = {
      worker_name: 'E2E Demo Worker',
      policy_number: `E2E-${Date.now()}`,
      coverage_type: 'basic',
      weekly_premium: 10.0,
      active: true,
      notes: 'E2E created policy',
    };
    const policyRes = await fetch('http://localhost:8000/api/policies', { method: 'POST', headers, body: JSON.stringify(policyPayload) });
    const policyJson = await policyRes.json().catch(() => null);
    console.log('/api/policies create:', policyRes.status, policyJson);
    const policyId = policyJson?.id;

    // Create a claim
    const claimPayload = {
      policy_id: policyId || 'unknown',
      claim_number: `CL-${Date.now()}`,
      title: 'E2E Demo Claim',
      description: 'Test claim created by e2e script',
      claim_amount: 120.0,
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
    const payoutPayload = { claim_id: claimId, amount: 120.0, recipient_identifier: 'demo@upi', gateway: 'upi' };
    const payoutRes = await fetch('http://localhost:8000/api/payouts', { method: 'POST', headers, body: JSON.stringify(payoutPayload) });
    const payoutJson = await payoutRes.json().catch(() => null);
    console.log('/api/payouts:', payoutRes.status, payoutJson);

    console.log('E2E demo complete.');
    process.exit(0);
  } catch (err) {
    console.error('E2E demo error:', err);
    process.exit(1);
  }
})();
