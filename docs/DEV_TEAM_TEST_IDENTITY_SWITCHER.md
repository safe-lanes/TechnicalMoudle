# Development Test Identity Switcher

## Purpose

This is a development-only impersonation tool for testing approval workflows with real `master_users` identities and real vessel-assignment rows. It extends the existing RoleSwitcher; it is not a production feature.

The switcher has no authentication of its own. Anyone who can reach an enabled development instance can select an eligible user and make requests as that user. The environment gates and the persistent warning banner are the safeguards.

## Environment gates

The feature fails closed on both client and server.

### Client gate

`client/src/lib/env.ts:8-9` enables the controls only when the browser build has:

```text
VITE_APP_ENV=replit
```

The RoleSwitcher query is disabled outside that environment, and the development controls render only after the guarded server capability request succeeds (`client/src/components/RoleSwitcher.tsx:113-130,286-287`).

`VITE_APP_ENV` is browser-visible and is not a sufficient security boundary by itself.

### Server gate

Every route is protected by `server/modules/dev-test-users/devTestUsersGuard.ts:8-12`. Both conditions must be true:

```text
REPL_ID=<Replit-injected value>
DEV_TEST_IDENTITY_SWITCHER_ENABLED=true
```

- `REPL_ID` is injected and runtime-managed by Replit. A copied `.env` file does not create a genuine Replit runtime identity.
- `DEV_TEST_IDENTITY_SWITCHER_ENABLED` is a server-only, non-`VITE_` explicit opt-in. It is currently set only for the Replit development environment.

If either value is absent, empty, or incorrect, all development test-user endpoints return HTTP 404. Tests cover no variables, `REPL_ID` only, and opt-in only, including middleware ordering before tenant authentication, in `server/modules/dev-test-users/__tests__/devTestUsersGuard.test.ts:75-124`.

## Identity behavior

Selecting a user changes both identity mechanisms together:

- `x-user-id`
- `x-user-name`
- `x-user-email`
- `x-user-type`
- `x-user-role`
- `x-rank`

`client/src/lib/activeRank.ts:78-107` updates rank and identity atomically in memory. The central interceptor installed by `client/src/lib/queryClient.ts:1-5` replaces all six headers together for Technical API requests (`client/src/lib/activeRank.ts:155-170`). Selection is React/module memory only; it is never written to localStorage or sessionStorage.

The original authenticated/default user remains in AuthContext so reset can restore the exact original rank and forwarded identity (`client/src/contexts/AuthContext.tsx:292-299,435-448`). UserMenu reads the effective AuthContext user, so it shows the impersonated identity while active.

The persistent banner is mounted above the application route switch in `client/src/App.tsx:29-46`. It therefore covers both TechnicalModule pages and standalone routes such as `/defects/edit/:id` (`client/src/App.tsx:87-98`). It uses a fixed layer above the standalone form overlays and only offers “Return to default user” (`client/src/components/RoleSwitcher.tsx:399-437`).

Audit and approval records receive the selected identity through the normal forwarded headers. No test marker is written to application data.

## Endpoints

All paths are under `/technical/api`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dev/test-users` | List active, non-deleted users, active vessels, active assignments, and approval roles. |
| GET | `/dev/test-users/:userId/resolution` | Return bounded live approver resolution for one selected user across active vessels. |
| POST | `/dev/test-users/:userId/vessels` | Activate or create one assignment. Body: `{ "vuuid": "<vessels.vuuid>" }`. |
| DELETE | `/dev/test-users/:userId/vessels/:vuuid` | Deactivate one assignment without deleting its history. |

Route registration is in `server/modules/dev-test-users/devTestUsersRoutes.ts:13-17`.

Assignment writes use `vessels.vuuid` as `master_user_vessels.vessel_id`, never `vessels.id`. Reactivation uses the same pending/retry-reset shape as the SAILERP login-capture writer; deactivation retains the row and sets the production revoke shape.

Live feedback calls `resolveRoleApproverUserIds` from the approvals module only for the selected user’s matching active role IDs and active vessels. This keeps work bounded to the selected user and does not duplicate or modify Approval Engine logic.

## Files

### Added

- `server/modules/dev-test-users/devTestUsersRoutes.ts`
- `server/modules/dev-test-users/devTestUsersGuard.ts`
- `server/modules/dev-test-users/controllers/devTestUsersController.ts`
- `server/modules/dev-test-users/services/devTestUsersService.ts`
- `server/modules/dev-test-users/repositories/devTestUsersRepository.ts`
- `server/modules/dev-test-users/__tests__/devTestUsersGuard.test.ts`
- `docs/DEV_TEAM_TEST_IDENTITY_SWITCHER.md`

### Changed

- `server/modules/index.ts`
- `client/src/App.tsx`
- `client/src/components/RoleSwitcher.tsx`
- `client/src/contexts/AuthContext.tsx`
- `client/src/contexts/UIRoleContext.tsx`
- `client/src/lib/activeRank.ts`

No schema, migration, sync, Approval Engine core, approval classification, routing, or decision files are changed.

## Use

1. Confirm the app is running in Replit development with both server variables enabled.
2. Open the existing RoleSwitcher in the top bar.
3. Select a real test user.
4. Confirm UserMenu and the persistent banner show that user.
5. Toggle vessel assignments using the vessel checkboxes.
6. Read the live resolution row for each vessel:
   - **Does not resolve** means the user is not currently included by any active approval role for that vessel.
   - **Resolves (N)** means the user is currently included by `N` active approval role IDs.
7. Select “Return to default user” before continuing normal development work.

New approval requests persist resolved user IDs when their step activates. Create or activate the request after the assignment exists when testing a decision.

## Mandatory deployment check

Before any deployment outside Replit, verify this mechanism is inert or remove it entirely.

At minimum:

1. Ensure `DEV_TEST_IDENTITY_SWITCHER_ENABLED` is absent from production.
2. Confirm `GET /technical/api/dev/test-users` returns HTTP 404.
3. Confirm the RoleSwitcher has no test-user controls.
4. Confirm no test-identity banner can be activated.

Do not treat the client gate as sufficient. The server 404 check is mandatory.