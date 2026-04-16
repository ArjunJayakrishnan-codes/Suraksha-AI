Phase 3 Integration - Advanced Fraud & Instant Payouts

Overview

This project now includes Phase‑3 deliverables:

- Advanced Fraud Detection
  - GPS spoofing heuristics, fake weather checks, duplicate detection (see `fraud_detection.py`).
  - Admin endpoint: POST `/api/fraud-advanced` — scans recent claims and returns flagged summary.
- Instant Payout Simulator
  - Simulated UPI/Razorpay/Stripe transfers with realistic mock responses (see `payment_simulator.py`).
  - Endpoints: POST `/api/payouts` (single payout), GET `/api/payouts`, GET `/api/payouts/analytics`, POST `/api/payout-sim` (bulk simulation).
- Intelligent Dashboard
  - Admin and Worker views in `src/pages/Dashboard.tsx`.
  - Admin controls to run advanced fraud scan and simulate payouts from the UI.

Quick demo scripts

- `scripts/e2e_supabase_client.mjs` — sign in with Supabase credentials from `.env.local` and run a single policy → claim → fraud-check → payout flow.
- `scripts/simulate_rainstorm.mjs` — create policies/claims simulating a rainstorm, run `/api/fraud-advanced` and `/api/payout-sim`.

Running locally

1. Start backend (Python venv):

```powershell
& .\.venv\Scripts\Activate.ps1
uvicorn api_server:app --reload --host 0.0.0.0 --port 8000
```

2. Start frontend (from project root):

```bash
npm install
npm run dev
# open http://localhost:8081
```

3. Put Supabase keys and credentials into `.env.local`.

4. Run the rainstorm demo (uses `.env.local` Supabase credentials):

```bash
node scripts/simulate_rainstorm.mjs
```

Notes & next steps

- For a production-ready pipeline, connect `fraud_detection` to a real weather API and use real GPS coordinates.
- Replace the simulator with real payment gateway integration (Razorpay/Stripe) and secure service-role keys.
- To create the 5-minute demo video: run `simulate_rainstorm.mjs`, record the dashboard and the UI flows showing auto-approval and payouts.
