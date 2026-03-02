# Role-Based Access Control (RBAC) — Analysis & Implementation Plan

## Step 2 — Data Structure Analysis

### LocalStorage Keys

The following keys are expected in localStorage after deployment:

---

#### 1. `userProfile`
**Expected Structure:**
```json
{
  "id": 1,
  "username": "john.doe",
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "department": "Engineering",
  "crewDesignation": "Chief Engineer",
  "vesselId": "vessel-uuid",
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-15T00:00:00Z"
}
```
**Key Fields:**
- `id` — unique user identifier
- `fullName`, `email` — identity/display
- `department`, `crewDesignation` — organizational context
- `vesselId` — vessel assignment (critical for data isolation)
- `isActive` — account status flag

---

#### 2. `userRole`
**Expected Structure:**
```json
"Office"
```
or
```json
{ "role": "Office", "systemRole": "PMS Admin" }
```
**Possible Values (System Roles):** `"Ship"`, `"Office"`, `"PMS Admin"`

**Key Fields:**
- Determines the broad permission tier for backend authorization
- Maps to middleware guards: `requireShipUser`, `requireOfficeOrAdmin`, `requirePMSAdmin`

---

#### 3. `userType`
**Expected Structure:**
```json
"Sail_Admin"
```
or
```json
{ "type": "Sail_Admin", "label": "Sail Admin" }
```
**Possible Values (UI Roles):** `"Sail_Admin"`, `"Client_Admin"`, `"Head_of_Dept"`, `"Vessel"`

**Key Fields:**
- Controls UI-level visibility and module access
- Determines which features/sections are shown or hidden in the interface

---

#### 4. `credentials`
**Expected Structure:**
```json
{
  "token": "jwt-token-string",
  "refreshToken": "refresh-token-string",
  "expiresAt": 1709395200000,
  "sessionId": "session-uuid"
}
```
**Key Fields:**
- `token` — JWT or session token for API authentication
- `refreshToken` — for silent token renewal
- `expiresAt` — expiry timestamp for re-validation logic
- `sessionId` — server-side session reference

---

#### 5. `Role_Access_Data`
**Expected Structure:**
```json
{
  "roleId": "role-uuid",
  "roleName": "Office",
  "modules": {
    "pms": { "read": true, "write": true, "approve": false, "admin": false },
    "defects": { "read": true, "write": true, "approve": true, "admin": false },
    "spares": { "read": true, "write": false, "approve": false, "admin": false },
    "stores": { "read": true, "write": false, "approve": false, "admin": false },
    "reports": { "read": true, "write": false, "approve": false, "admin": false },
    "admin": { "read": false, "write": false, "approve": false, "admin": false },
    "certSurveys": { "read": true, "write": true, "approve": false, "admin": false }
  },
  "actions": {
    "createWorkOrder": true,
    "editWorkOrder": true,
    "deleteWorkOrder": false,
    "approveWorkOrder": false,
    "createDefect": true,
    "editDefect": true,
    "closeDefect": true,
    "approveDefect": false,
    "manageFleet": false,
    "manageUsers": false,
    "bulkImport": false,
    "exportData": true
  },
  "vesselAccess": "all" | "assigned" | ["vessel-id-1", "vessel-id-2"]
}
```
**Key Fields:**
- `modules` — per-module permission matrix (read/write/approve/admin)
- `actions` — granular action-level permissions
- `vesselAccess` — scope of data visibility across vessels

---

### Relationship Between Keys

```
userProfile ──────── WHO the user is (identity + assignment)
     │
userRole ─────────── WHAT system-level tier they belong to (Ship / Office / PMS Admin)
     │                  ↳ Used by backend middleware for route protection
     │
userType ─────────── WHAT UI-level persona they have (Sail_Admin / Client_Admin / etc.)
     │                  ↳ Used by frontend for feature visibility
     │
Role_Access_Data ─── WHAT they can do (granular permissions per module and action)
     │                  ↳ Single source of truth for RBAC decisions
     │
credentials ──────── HOW they prove identity (tokens, session, expiry)
                        ↳ Used for API authentication and session management
```

**Hierarchy:**
1. `credentials` validates the session is active
2. `userRole` determines the broad authorization tier
3. `userType` refines the UI experience within that tier
4. `Role_Access_Data` provides granular, action-level permissions
5. `userProfile` provides context (vessel assignment, department) for data isolation

---

## Step 3 — Role-Based Functionality Plan

### 3.1 Route Guarding

**Frontend (React):**
- Use `Role_Access_Data.modules[moduleName].read` to determine if a route is accessible
- Wrap routes in a `<PermissionGuard>` component that checks both `userRole` and `Role_Access_Data`
- Redirect unauthorized users to a "No Access" page instead of silently hiding content
- Check `credentials.expiresAt` before each navigation; redirect to login if expired

**Backend (Express):**
- Continue using existing middleware (`requireAuth`, `requireRole`, `requireVesselAccess`)
- Enhance by validating `Role_Access_Data` claims server-side against the database
- Never trust localStorage data alone — always verify against the server on sensitive operations

---

### 3.2 Feature / Module Visibility

| Module | Sail_Admin | Client_Admin | Head_of_Dept | Vessel |
|--------|-----------|-------------|-------------|--------|
| PMS (Components, RH, WO) | Full | Read + Write | Read + Write (own dept) | Read + Write (own vessel) |
| Defects | Full | Read + Write + Approve | Read + Write | Read + Write (own vessel) |
| Spares | Full | Read + Write | Read | Read (own vessel) |
| Stores | Full | Read + Write | Read | Read (own vessel) |
| Reports | Full | Read + Export | Read | Limited |
| Admin (Fleet, Users, Masters) | Full | Limited | No Access | No Access |
| Cert & Surveys | Full | Read + Write | Read | Read (own vessel) |

Implementation:
- Read `Role_Access_Data.modules` to dynamically show/hide sidebar items
- Use the existing `RoleGuard` component, extended to also check `Role_Access_Data`

---

### 3.3 Action-Level Permissions

| Action | PMS Admin | Office | Ship |
|--------|----------|--------|------|
| Create Work Order | ✅ | ✅ | ✅ (own vessel) |
| Edit Work Order | ✅ | ✅ | ✅ (own vessel, draft only) |
| Delete Work Order | ✅ | ❌ | ❌ |
| Approve Work Order | ✅ | ✅ | ❌ |
| Create Defect | ✅ | ✅ | ✅ |
| Edit Defect | ✅ | ✅ | ✅ (own vessel) |
| Close Defect | ✅ | ✅ | ❌ |
| Approve Defect | ✅ | ❌ | ❌ |
| Manage Fleet | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ |
| Bulk Import | ✅ | ✅ | ❌ |
| Export Data | ✅ | ✅ | ✅ (own vessel) |

Implementation:
- Check `Role_Access_Data.actions[actionName]` before rendering action buttons
- Send `userRole` + action context to backend; backend verifies against database
- Disable buttons (with tooltip explaining why) rather than hiding them, for discoverability

---

### 3.4 Backend Authorization Validation

- **Do not rely solely on localStorage.** The frontend sends the token from `credentials` with each request.
- Backend validates the token, looks up the user's current role and permissions from the database.
- `Role_Access_Data` in localStorage is a **cache for UI responsiveness** — the backend is the authority.
- On any write/mutate operation, backend must independently verify:
  1. Token validity (not expired, not revoked)
  2. User role matches the required role for the endpoint
  3. Vessel access is appropriate (Ship users only access their vessel)
  4. Action-level permission exists for the specific operation

---

### 3.5 Single Source of Truth

- **Database** is the ultimate source of truth for all role and permission data
- `Role_Access_Data` in localStorage is a **read-only cache** populated on login
- Any permission check that gates a destructive action must be verified server-side
- Frontend uses localStorage for fast UI rendering; backend re-validates on every API call

---

### 3.6 Re-Validation Strategy

| Event | Action |
|-------|--------|
| **Login** | Fetch fresh `userProfile`, `userRole`, `userType`, `credentials`, `Role_Access_Data` from server and store in localStorage |
| **Logout** | Clear all 5 keys from localStorage |
| **Role Change** (admin changes user's role) | Server pushes update via WebSocket or next API call returns 403 → triggers re-fetch |
| **Token Expiry** | Check `credentials.expiresAt` before API calls; if expired, use `refreshToken` to get new token; if refresh fails, redirect to login |
| **App Load / Page Refresh** | Read from localStorage for instant UI, then validate session with a lightweight `/api/auth/verify` call in the background |
| **Periodic Check** | Every 15-30 minutes, silently verify the session and refresh `Role_Access_Data` if the server version has changed |

---

### 3.7 Missing / Ambiguous Data for Complete RBAC

1. **`Role_Access_Data` does not exist yet** — The current codebase has no dedicated permissions matrix table or API endpoint. This needs to be designed and built.

2. **No token-based auth** — The app currently uses mock authentication (`mockAuthMiddleware`). Real JWT or session-based auth must be implemented before `credentials` can function.

3. **No permissions database table** — A `role_permissions` or `access_control` table is needed to store the granular module + action permissions that `Role_Access_Data` represents.

4. **UI Role ↔ System Role mapping is unclear** — The relationship between `userRole` (Ship/Office/PMS Admin) and `userType` (Sail_Admin/Client_Admin/Head_of_Dept/Vessel) needs a clear, documented mapping.

5. **Department-level access** — `Head_of_Dept` role implies department-scoped access, but no department-level data isolation exists in the current middleware.

6. **Audit trail** — No logging of who accessed what, when permissions were checked, or when access was denied. This is important for compliance in maritime systems.

7. **Encryption for localStorage** — Currently data is stored as plain JSON. Sensitive data like `credentials` should be encrypted (e.g., AES-256) before storing in localStorage.
