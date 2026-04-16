# Access Control Implementation - Comprehensive Fixes

## Summary
Fixed all entity key mismatches and added missing access control to CRUD routes across the entire backend. Standardized action names to use consistent terminology (VIEW, EDIT, CREATE, DELETE).

---

## Backend Route Files Fixed

### 1. **Account Module Routes**

#### ✅ accountRoutes.js
- **Changed**: `CHART_OF_ACCOUNTS` → `CHART OF ACCOUNTS` (match initializeEntities)
- **Added VIEW access control** to GET routes:
  - `getAllAccounts()` - now protected
  - `getAccountById()` - now protected  
  - `getAccountByCode()` - now protected
  - `getLedger()` - now protected

#### ✅ journalRoutes.js
- **Changed**: `Journal` → `JOURNAL` (line 42 and 48 - case mismatch)
- **Added VIEW access control** to GET routes:
  - `getAllJournals()` - now protected
  - `getJournalStats()` - now protected
  - `getPendingApprovals()` - now protected
  - `getJournalApprovalRequests()` - now protected
  - `getJournalById()` - now protected

#### ✅ groupRoutes.js
- **Added VIEW access control** to GET routes:
  - `getAllGroups()` - now protected
  - `getGroupById()` - now protected

#### ✅ accountTypeRoutes.js
- **Changed**: `AccountType` → `ACCOUNT_TYPE` (case and format)
- **Changed**: `UPDATE` → `EDIT` (action standardization)
- **Added VIEW access control** to GET routes:
  - `getAllAccountTypes()` - now protected
  - `getAccountTypeByGroup()` - now protected

#### ✅ paymentRoutes.js
- **Changed**: `Payment` → `PAYMENT` (uppercase)
- **Changed**: `UPDATE` → `EDIT` (action standardization)
- **Changed**: `RECONCILE` → `EDIT` (standardize to standard actions)
- **Added VIEW access control** to GET routes:
  - `getAllPayments()` - now protected
  - `getPaymentStats()` - now protected
  - `getPaymentsByClient()` - now protected
  - `getPaymentsByInvoice()` - now protected
  - `getPendingReconciliations()` - now protected
  - `getTDSReport()` - now protected
  - `getPaymentById()` - now protected

#### ✅ reportRoutes.js
- **Changed**: `Report` → Entity-specific keys:
  - Ledger reports use `CHART OF ACCOUNTS`
  - Trial Balance reports use `TRIAL BALANCE`
  - Balance Sheet reports use `BALANCE SHEET`
  - P&L reports use `PROFIT AND LOSS`
  - Financial statements use `CHART OF ACCOUNTS`
- **Changed**: `READ` → `VIEW` (action standardization)

#### ✅ journalExcelRoutes.js
- **Changed**: `Journal` → `JOURNAL` (case mismatch)

---

### 2. **Master Data Module Routes**

#### ✅ clientRoutes.js
- **Changed**: `CLIENT` → `CLIENTS` (match initializeEntities)
- All routes now use consistent entity key

#### ✅ vendorRoutes.js
- ✓ Already properly implemented with access control

---

### 3. **Invoice Module Routes**

#### ✅ invoiceRoutes.js
- **Changed**: `Invoice` → `INVOICE` (uppercase)
- **Changed**: `READ` → `VIEW` (action standardization)
- **Changed**: `UPDATE` → `EDIT` (action standardization)
- **Changed**: `APPROVE` → `EDIT` (map to standard actions)

#### ✅ purchaseOrderRoutes.js
- **Changed**: `PurchaseOrder` → `PURCHASE_ORDER` (match initializeEntities)
- **Changed**: `READ` → `VIEW` (action standardization)
- **Changed**: `UPDATE` → `EDIT` (action standardization)

#### ✅ invoiceAccountingRoutes.js
- ✓ Already properly implemented

---

## New Files Created

### ✅ src/constants/entityKeys.js
**Purpose**: Centralized source of truth for entity keys and permission actions

**Exports**:
```javascript
ENTITY_KEYS // Object with all entity constants (JOURNAL, CLIENTS, INVOICE, etc.)
PERMISSION_ACTIONS // Object with standard actions (CREATE, VIEW, EDIT, DELETE)
isValidEntityKey() // Validate entity keys
isValidAction() // Validate actions
getEntityDisplayName() // Get human-readable names
```

**Usage**:
```javascript
import { ENTITY_KEYS, PERMISSION_ACTIONS } from '../constants/entityKeys.js';

// Use in routes
router.get('/journals', 
  accessControlMiddleware({ entityKey: ENTITY_KEYS.JOURNAL, action: PERMISSION_ACTIONS.VIEW }),
  getJournals
);
```

---

## Key Changes Made

### 1. **Entity Key Standardization**
| Old | New | Reason |
|-----|-----|--------|
| `CLIENT` | `CLIENTS` | Match initializeEntities definition |
| `CHART_OF_ACCOUNTS` | `CHART OF ACCOUNTS` | Match initializeEntities (spaces) |
| `Payment` | `PAYMENT` | Uppercase for consistency |
| `Invoice` | `INVOICE` | Uppercase for consistency |
| `PurchaseOrder` | `PURCHASE_ORDER` | Match initializeEntities format |
| `ACCOUNT_TYPE` | `ACCOUNT_TYPE` | Already correct |
| `Report` | Entity-specific | Map to actual entity being reported |

### 2. **Action Standardization**
| Old | New | Reason |
|-----|-----|--------|
| `READ` | `VIEW` | Standard permission action |
| `UPDATE` | `EDIT` | Standard permission action |
| `APPROVE` | `EDIT` | Map to standard action |
| `RECONCILE` | `EDIT` | Map to standard action |
| `CREATE` | `CREATE` | Already correct |
| `DELETE` | `DELETE` | Already correct |

### 3. **Missing Access Control Added**
Added `accessControlMiddleware` to all GET endpoints that were previously unprotected:
- ✓ Account listing and retrieval
- ✓ Journal listing and retrieval
- ✓ Group listing and retrieval
- ✓ Account type listing and retrieval
- ✓ Payment listing and retrieval
- ✓ All reporting endpoints
- ✓ And more...

---

## Frontend Integration Required

### Next Steps for Frontend

1. **Install Constants**
   - Copy `src/constants/entityKeys.js` to frontend (or import from backend API)

2. **Update Navbar Component**
   ```javascript
   import { ENTITY_KEYS } from '../constants/entityKeys.js';
   
   // Filter menu items based on user permissions
   const getUserMenuItems = (userPermissions) => {
     return MENU_ITEMS.filter(item => 
       userPermissions.some(perm => perm.entity === ENTITY_KEYS[item.entityKey])
     );
   };
   ```

3. **Update Feature Guards**
   ```javascript
   // Before showing a feature, check permissions
   const canViewJournals = userPermissions.some(perm =>
     perm.entity === ENTITY_KEYS.JOURNAL && 
     perm.actions.includes('VIEW')
   );
   ```

4. **Update API Calls**
   - No changes needed - backend now enforces access on all routes

---

## Testing Checklist

- [ ] All GET endpoints return 403 for users without VIEW permission
- [ ] All POST/PUT/DELETE endpoints require appropriate permissions
- [ ] SuperAdmin bypass still works (skips permission checks)
- [ ] Entity keys match between backend initialization and route usage
- [ ] All permission actions are standardized (CREATE, VIEW, EDIT, DELETE)
- [ ] Test with user having partial permissions (e.g., JOURNAL only)
- [ ] Test with user having no permissions
- [ ] Frontend navbar reflects permission restrictions

---

## Files Modified

**Backend Routes** (13 files):
1. ✅ src/modules/Account/routers/accountRoutes.js
2. ✅ src/modules/Account/routers/journalRoutes.js
3. ✅ src/modules/Account/routers/groupRoutes.js
4. ✅ src/modules/Account/routers/accountTypeRoutes.js
5. ✅ src/modules/Account/routers/paymentRoutes.js
6. ✅ src/modules/Account/routers/reportRoutes.js
7. ✅ src/modules/Account/routers/journalExcelRoutes.js
8. ✅ src/modules/masterData/routers/clientRoutes.js
9. ✅ src/modules/Invoice/routers/invoiceRoutes.js
10. ✅ src/modules/Invoice/routers/purchaseOrderRoutes.js
11. ✅ src/modules/Invoice/routers/invoiceAccountingRoutes.js (no changes needed)
12. ✅ src/modules/masterData/routers/vendorRoutes.js (no changes needed)
13. ✅ src/modules/masterData/routers/hsnRoutes.js (no changes needed)

**New Files Created** (1 file):
1. ✅ src/constants/entityKeys.js

---

## Verification Command

After deployment, verify access control is working:

```bash
# Should return 403 Forbidden (without permission)
curl -X GET http://localhost:8080/api/accounting/account \
  -H "Authorization: Bearer <token_for_user_without_permission>" \
  -H "Accept: application/json"

# Should return 200 OK (with permission)
curl -X GET http://localhost:8080/api/accounting/account \
  -H "Authorization: Bearer <token_for_admin>" \
  -H "Accept: application/json"
```

---

## Summary of Improvements

✅ **Before**: Users could access features without proper permissions (no access control on GETs)
✅ **After**: All routes are protected; access controlled at middleware level
✅ **Entity Key Consistency**: All entity keys now match definitions in initializeEntities.js
✅ **Action Standardization**: All actions use standard CREATE, VIEW, EDIT, DELETE
✅ **Centralized Constants**: entityKeys.js prevents future typos and mismatches
