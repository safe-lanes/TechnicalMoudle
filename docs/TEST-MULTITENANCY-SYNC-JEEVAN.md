# Multi-Tenancy — Testing Guide (Jeevan + Domain Team)

What we're testing: each shipping company's data stays in its **own** space, and when a ship syncs, its data reaches **only its own company** on shore. No code — everything below is done in the app.

You'll use two companies, e.g. **Wah Kwong (WK)** and **Primeconav**.

---

## 1. Log in to each company

1. Log in with a **WK** user → you're in WK's data.
2. Log out, log in with a **Primeconav** user → you're in Primeconav's data.

**✅ What good looks like:** each login lands in the correct company. The vessels/components/work orders you see belong to that company only.

**🚩 Report if:** a login shows the wrong company's vessels, or a mix of both. Note which login you used and which company's data appeared.

---

## 2. Verify each company sees only its own data

For **each** company, open the main modules and check the records belong to that company:
- Components, Spares, Stores, Work Orders, Defects, Noon Reports.

**✅ What good looks like:** WK sees only WK vessels/records; Primeconav sees only Primeconav's. No record from the other company appears anywhere.

**🚩 Report if:** you see any vessel, component, work order, etc. that belongs to the other company. Note the module, the screen, and the record you saw.

---

## 3. Sync testing (the main test)

Do this **per ship** (start with the WK ship).

### 3a. Trigger a sync from the ship
On the **ship**: Admin → **Sync Dashboard** → **Sync Now**.

**✅ What good looks like:** the sync runs and finishes with a success status (no error). The dashboard shows pushed/pulled counts and a completion time.

### 3b. Confirm the ship's data reached shore — for the RIGHT company
On the **shore**, logged in as that **same company**: open the module you changed on the ship (e.g. a work order you updated, or running hours you entered) and confirm the change is now visible.

**✅ What good looks like:** the ship's change appears in **that company's** data on shore.

**🚩 Report if:** the change doesn't appear, or appears under the **wrong** company. Note: which company you logged into on shore, which record you expected, and what you saw.

### 3c. Confirm the OTHER company is NOT affected
Log in to shore as the **other** company (the one whose ship did **not** sync). Check its data is unchanged — the sync from the first ship must not have touched it.

**✅ What good looks like:** the other company's data is exactly as before — nothing new, nothing changed from the other ship's sync.

**🚩 Report if:** the other company's data changed after a sync it shouldn't have. This is the most important thing to catch — note both companies and what changed.

### 3d. Confirm on the Fleet Sync Overview
On the **shore** (office), open Admin → **Fleet Overview** (Fleet Sync Overview).

**✅ What good looks like:** the vessel you just synced shows a recent **Last Sync** time (e.g. "just now" / a few minutes ago) and a **green / Synced** status.

**🚩 Report if:** the vessel shows red/amber, "Never synced," or a stale (old) last-sync time right after a successful Sync Now. Note the vessel name and the status shown.

---

## 4. Repeat for the second ship/company

Do steps 3a–3d from the **Primeconav** ship. Then re-check that **WK** is unaffected by Primeconav's sync (and vice-versa).

**✅ What good looks like:** each ship's sync updates only its own company; the Fleet Overview shows both vessels green with recent sync times.

---

## Quick checklist (tick per company)

- [ ] Login lands in the correct company.
- [ ] Every module shows only that company's records (no cross-company data).
- [ ] Sync Now on the ship completes successfully.
- [ ] The ship's change appears on shore under the **correct** company.
- [ ] The **other** company's data is unchanged after that sync.
- [ ] Fleet Overview shows the vessel green with a recent last-sync time.

## How to report a problem
Tell us, in plain words:
1. **Which company** you were logged into (and on ship or shore).
2. **Which screen** (module + page name).
3. **What you expected** vs **what you saw** (a screenshot helps).
4. If it's a data-mixing issue (one company seeing another's data, or a sync changing the wrong company) — flag it as **urgent**; that's exactly what this test is guarding against.
