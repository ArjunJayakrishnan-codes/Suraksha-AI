(async () => {
  try {
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer mock-dev-token' };

    // Create policy
    const policyPayload = {
      worker_name: 'Dev Demo Worker',
      policy_number: `DEV-${Date.now()}`,
      coverage_type: 'basic',
      weekly_premium: 10.0,
      active: true,
      notes: 'Dev-mode policy',
    };

    const policyRes = await fetch('http://localhost:8000/api/policies', { method: 'POST', headers, body: JSON.stringify(policyPayload) });
    const policyJson = await policyRes.json().catch(() => null);
    console.log('/api/policies create:', policyRes.status, policyJson);
    const policyId = policyJson?.id;

    // Create claim
    const claimPayload = {
      policy_id: policyId || 'dev-policy',
      claim_number: `CL-${Date.now()}`,
      title: 'Dev Demo Claim',
      description: 'Test claim created by dev e2e script',
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
    const payoutPayload = { claim_id: claimId, amount: 120.0, recipient_identifier: 'dev@upi', gateway: 'upi' };
    const payoutRes = await fetch('http://localhost:8000/api/payouts', { method: 'POST', headers, body: JSON.stringify(payoutPayload) });
    const payoutJson = await payoutRes.json().catch(() => null);
    console.log('/api/payouts:', payoutRes.status, payoutJson);

    console.log('Dev E2E demo complete.');
    process.exit(0);
  } catch (err) {
    console.error('Dev E2E demo error:', err);
    process.exit(1);
  }
})();
