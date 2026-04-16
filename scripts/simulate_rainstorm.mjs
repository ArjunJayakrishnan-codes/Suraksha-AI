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

    const supabase = createClient(SUPABASE_URL, API_KEY, { auth: { persistSession: false } });
    const email = 'aerinuchiaga@gmail.com';
    const password = '123456';
    console.log('Signing in as', email);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Sign-in error:', error);
      process.exit(1);
    }

    const token = data?.session?.access_token;
    if (!token) {
      console.error('No access token returned');
      process.exit(1);
    }

    console.log('Creating simulated rainstorm claims...');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Create a few storm claims
    for (let i = 0; i < 6; i++) {
      const policyPayload = {
        worker_name: `Storm Worker ${i}`,
        policy_number: `RAIN-${Date.now()}-${i}`,
        coverage_type: 'standard',
        weekly_premium: 12.0,
        active: true,
        notes: 'Simulated by simulate_rainstorm'
      };
      await fetch('http://localhost:8000/api/policies', { method: 'POST', headers, body: JSON.stringify(policyPayload) });
    }

    // Create claims referencing created policies (quick approach: fetch policies and use first ones)
    const policiesRes = await fetch('http://localhost:8000/api/policies', { headers });
    const policies = await policiesRes.json();
    const toUse = policies.slice(0, 6);

    for (let i = 0; i < toUse.length; i++) {
      const claimPayload = {
        policy_id: toUse[i].id,
        claim_number: `RAIN-CL-${Date.now()}-${i}`,
        title: 'Delivery lost during storm',
        description: 'Package lost due to heavy rainstorm and flooding',
        claim_amount: Math.floor(50 + Math.random() * 300),
        delivery_location: 'Metro Area',
        weather_condition: 'stormy',
        claim_date: new Date().toISOString().split('T')[0],
      };
      await fetch('http://localhost:8000/api/claims', { method: 'POST', headers, body: JSON.stringify(claimPayload) });
    }

    console.log('Triggering advanced fraud scan (/api/fraud-advanced)');
    const adv = await fetch('http://localhost:8000/api/fraud-advanced', { method: 'POST', headers, body: JSON.stringify({}) });
    console.log('Advanced fraud result:', await adv.json());

    console.log('Triggering payout simulation (/api/payout-sim)');
    const sim = await fetch('http://localhost:8000/api/payout-sim', { method: 'POST', headers, body: JSON.stringify({ max_count: 6, amount: 150 }) });
    console.log('Payout simulation result:', await sim.json());

    console.log('Rainstorm simulation complete.');
    process.exit(0);
  } catch (err) {
    console.error('simulate_rainstorm error:', err);
    process.exit(1);
  }
})();
