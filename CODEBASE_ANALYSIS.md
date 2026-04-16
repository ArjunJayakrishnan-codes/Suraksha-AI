# Secure Gig Guardian - Codebase Analysis
## Role-Based Approval Workflow Assessment

**Date:** April 16, 2026  
**Status:** Phase 3 Complete - Approval Workflow NOT YET IMPLEMENTED

---

## 1. CURRENT AUTHENTICATION & ROLE SYSTEM

### Frontend ([useAuth.tsx](src/hooks/useAuth.tsx))
- **Current Implementation:**
  - ✅ Basic Supabase authentication (with mock fallback for development)
  - ✅ Session management with localStorage fallback
  - ⚠️ Only tracks `isAdmin` as a boolean flag
  - ⚠️ Calls `supabase.rpc("has_role", {_user_id, _role: "admin"})` to check admin status
  - ⚠️ Single role check - no granular permissions

```typescript
// Current structure
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;  // ← Only boolean, not multi-role
  signUp, signIn, signOut
}
```

### Route Protection ([ProtectedRoute.tsx](src/components/ProtectedRoute.tsx))
- ✅ Checks if user is authenticated
- ❌ Does NOT enforce role-based access
- ❌ Anyone authenticated can navigate to `/insurer` or `/worker`

**Problem:** No role-based route guards exist. User role is determined by which dashboard link they click, not enforced by permissions.

---

## 2. FRONTEND ROLE HANDLING (Worker vs Insurer/Admin)

### Routing Structure
- `/` - Main dashboard (accessible to all authenticated users)
- `/worker` - WorkerDashboard
- `/insurer` - InsurerDashboard  
- `/auth` - Authentication page

### Current Behavior
- ✅ Two separate dashboard pages exist with appropriate views
- ❌ No role-based routing - both dashboards always visible in nav bar
- ❌ No route middleware to prevent workers from accessing insurer dashboards
- ❌ Dashboard routing is purely UI-level, not enforced

### WorkerDashboard ([WorkerDashboard.tsx](src/pages/WorkerDashboard.tsx))
- Shows worker's policies, claims, and payouts
- Displays pending/approved claims counts
- Can view claim status and payout history
- **No approval actions available** (worker shouldn't approve)

### InsurerDashboard ([InsurerDashboard.tsx](src/pages/InsurerDashboard.tsx))
- Displays all policies (multiple workers)
- Shows all claims with fraud analysis
- Can trigger "Advanced Fraud Scan" and "Simulate Payouts"
- **No claim approval/rejection UI** (just fraud detection)

---

## 3. FRAUD DETECTION DATA IN INSURER DASHBOARD

### What's Displayed
✅ Fraud detection is well-implemented:
- Fraud analysis per claim with risk scores (0.0 to 1.0)
- Specific fraud flags/indicators detected
- Recommendation status: `APPROVE`, `REVIEW`, or `REJECT`
- Risk categorization:
  - `risk_score > 0.7` → REJECT recommendation
  - `0.4 < risk_score ≤ 0.7` → REVIEW recommendation  
  - `risk_score ≤ 0.4` → APPROVE recommendation

### API Endpoint
- `POST /api/fraud-check` - Analyzes claim for fraud (backend: [fraud_detection.py](fraud_detection.py))

### Current Display ([FraudDetectionAlert.tsx](src/components/FraudDetectionAlert.tsx))
```typescript
interface FraudAnalysis {
  is_fraudulent: boolean;
  risk_score: number;
  flags: string[];           // e.g., "GPS_SPOOFING", "FAKE_WEATHER_CLAIM"
  reason: string;            // Human-readable explanation
  recommendation: string;    // "APPROVE / REVIEW / REJECT"
}
```

### **BUT:** The recommendation is **JUST DISPLAYED AS TEXT** - not actionable

---

## 4. APPROVAL WORKFLOW UI

### ❌ DOES NOT EXIST YET

**What's missing:**
- No UI for insurers to approve/reject claims
- No "Approve" / "Reject" / "Request More Info" buttons
- No approval queue or prioritization
- No admin notes input field (field exists in DB but no UI)
- No status transition confirmation
- No audit trail display

### What Exists
- ✅ Claim status field in DB: `pending`, `under_review`, `approved`, `rejected`, `paid_out`
- ✅ Backend endpoint to update claim status: `PUT /api/claims/{claim_id}` with `status` field
- ✅ `admin_notes` field exists but no UI to set it
- ✅ Fraud detection recommendations available

### Current Claim Lifecycle (What Works)
```
1. Worker creates claim → status: "pending"
2. System runs fraud analysis → recommendation: APPROVE/REVIEW/REJECT
3. (Manual backend update or direct API call needed to change status)
4. If approved → status: "approved"
5. Worker can process payout → status: "paid_out"
```

---

## 5. CLAIMS API & DATA FLOW

### API Endpoints (Backend: [api_server.py](api_server.py), [claims_management.py](claims_management.py))

| Endpoint | Method | Purpose | Auth | Role Check |
|----------|--------|---------|------|-----------|
| `/api/claims` | GET | List user's claims | ✅ | ❌ Returns all user claims regardless of role |
| `/api/claims/{id}` | GET | Get single claim | ✅ | ❌ Owner-based filtering only |
| `/api/claims` | POST | Create claim | ✅ | ❌ Any authenticated user can create |
| `/api/claims/{id}` | PUT | Update claim status | ✅ | ❌ **CRITICAL: Any user can update any claim!** |
| `/api/claims/{id}` | DELETE | Delete claim | ✅ | ❌ Owner-based only |
| `/api/fraud-check` | POST | Analyze fraud | ✅ | ❌ No enforcement |
| `/api/payouts` | POST | Process payout | ✅ | ❌ **CRITICAL: Any user can initiate payouts!** |

### Claim Creation Flow ([ClaimsManagement.tsx](src/components/ClaimsManagement.tsx))
```typescript
// Frontend creates claim with:
{
  policy_id: string;
  claim_number: string;
  title: string;
  description: string;
  claim_amount: number;
  status: "pending";        // Always starts as pending
  admin_notes: "";
}

// POST /api/claims → Backend stores with owner_id = current_user
```

### Claim Status Update
```typescript
// Frontend can PUT to /api/claims/{claim_id}
{
  status: "approved" | "rejected" | "under_review" | "paid_out";
  admin_notes?: string;
}

// ❌ PROBLEM: No backend validation that caller is admin/insurer!
// ❌ PROBLEM: No state machine validation (e.g., pending → paid_out is invalid)
```

---

## 6. SUMMARY TABLE: IMPLEMENTED vs NEEDED

### ✅ ALREADY IMPLEMENTED
| Component | Status |
|-----------|--------|
| User authentication | ✅ Working |
| Session management | ✅ Working |
| Mock auth for development | ✅ Working |
| Claims CRUD API | ✅ Working |
| Fraud detection engine | ✅ Working |
| Fraud analysis display | ✅ Working |
| Payout processing API | ✅ Working |
| Multiple dashboard views | ✅ Working |
| Admin flag in auth context | ✅ Working (basic) |

### ❌ MISSING FOR COMPLETE APPROVAL WORKFLOW
| Component | Impact | Priority |
|-----------|--------|----------|
| **Role-based route protection** | Critical | HIGH |
| **Granular permission system** | High | HIGH |
| **Approval/rejection UI** | Critical | HIGH |
| **Admin notes input field** | Medium | MEDIUM |
| **Claim approval queue** | High | MEDIUM |
| **Status transition validation** | High | MEDIUM |
| **Backend role authorization checks** | Critical | HIGH |
| **Audit trail (approval history)** | Medium | MEDIUM |
| **Claim status change notifications** | Low | LOW |
| **Escalation/appeal workflow** | Low | LOW |

---

## 7. SECURITY ISSUES (CRITICAL)

### 🚨 Current Vulnerabilities

1. **No backend role validation on sensitive endpoints**
   ```python
   # Current code allows ANY authenticated user to do this:
   PUT /api/claims/{claim_id}  → Any user can change any claim status!
   POST /api/payouts           → Any user can initiate payouts for any claim!
   ```

2. **PUT /api/claims endpoint has no owner check**
   ```python
   # In api_server.py, update_claim() only checks require_user_id
   # But doesn't verify that user_id owns the claim or is admin
   def update_claim(claim_id: str, update: ClaimUpdate, user_id: str = Depends(require_user_id)):
       updated = cm.update_claim(claim_id, update.dict(), user_id)
       # ← This WILL fail for foreign claims, but no role check for admins
   ```

3. **Payout processing accessible to any user**
   - Any authenticated user can POST to `/api/payouts`
   - No check that user is approving their own claim or is authorized insurer

---

## 8. RECOMMENDED IMPLEMENTATION ROADMAP

### Phase 1: Backend Role Authorization (CRITICAL)
```typescript
// 1. Enhance useAuth.tsx
interface AuthContextType {
  roles: string[];              // ["worker", "insurer", "admin"]
  permissions: Set<string>;     // Granular permissions
  isRole: (role: string) => boolean;
  hasPermission: (perm: string) => boolean;
}

// 2. Add backend role checks
@app.put("/api/claims/{claim_id}")
def update_claim(claim_id: str, update: ClaimUpdate, 
                 user_id: str = Depends(require_user_id)):
    # NEW: Check if user is admin/insurer role
    # NEW: Validate state transitions
    # NEW: Log audit trail
```

### Phase 2: Frontend Approval UI (HIGH)
```typescript
// Components to create:
// 1. ApprovalQueue.tsx - List of claims pending approval
// 2. ClaimApprovalCard.tsx - Individual claim with fraud details + approve/reject buttons
// 3. AdminNotes.tsx - Rich text for admin notes
// 4. ApprovalHistory.tsx - Audit trail of who approved/rejected and when
```

### Phase 3: Role-Based Routing (HIGH)
```typescript
// ProtectedRoute enhancement:
<ProtectedRoute requiredRole="insurer">
  <InsurerDashboard />
</ProtectedRoute>

<ProtectedRoute requiredRole="worker">
  <WorkerDashboard />
</ProtectedRoute>
```

### Phase 4: Notifications & Workflow (MEDIUM)
```typescript
// Claim status change notifications to workers
// Real-time approval queue updates
// Escalation workflow for high-risk claims
```

---

## 9. KEY FILES TO MODIFY

### Frontend
- [useAuth.tsx](src/hooks/useAuth.tsx) - Enhance role system
- [ProtectedRoute.tsx](src/components/ProtectedRoute.tsx) - Add role checks
- [InsurerDashboard.tsx](src/pages/InsurerDashboard.tsx) - Add approval queue
- [ClaimsManagement.tsx](src/components/ClaimsManagement.tsx) - Remove approval UI (move to insurer-only)

### Backend
- [api_server.py](api_server.py) - Add role authorization on endpoints
- [claims_management.py](claims_management.py) - Add state validation
- Database schema - Add approval metadata (approver_id, approval_date, audit trail)

---

## 10. CONCLUSION

### Current State
✅ **Fraud detection** is well-implemented with solid recommendations  
✅ **Claims creation** works for workers  
✅ **Data persistence** works with MongoDB or in-memory storage  
❌ **No approval workflow UI** - recommendations exist but can't be actioned  
❌ **No role-based access control** - security vulnerability  
❌ **No status transition validation** - can create invalid claim states  

### For Production, You Need
1. Backend role authorization on all sensitive endpoints
2. Role-based route protection on frontend
3. Approval/rejection UI with admin notes
4. Audit trail for compliance
5. Status transition state machine
6. Granular permission system (beyond just boolean isAdmin)

### Time Estimate for Full Implementation
- **Phase 1 (Backend Auth):** 4-6 hours
- **Phase 2 (Approval UI):** 6-8 hours
- **Phase 3 (Route Protection):** 2-3 hours
- **Phase 4 (Notifications):** 3-4 hours
- **Total:** 15-21 hours for production-ready approval workflow

