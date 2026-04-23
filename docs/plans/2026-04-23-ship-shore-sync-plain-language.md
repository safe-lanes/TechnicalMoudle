# Ship-Shore Sync — Plain Language Explanation

**Date:** 2026-04-23
**Purpose:** Explain the sync architecture to domain experts and stakeholders in non-technical terms

---

## What We're Building

Today, your PMS system runs only on the cloud (AWS). Everyone — ship crew and office staff — connects to the same server over the internet.

The problem: **ships at sea have unreliable, slow internet (VSAT)**. If the internet drops, the crew can't access PMS at all.

The solution: **install a copy of PMS on each ship**. The ship crew works on their local copy (works even with zero internet). When they get a connectivity window, they press "Sync Now" and all changes flow between ship and office automatically.

---

## How It Works — The Simple Version

Think of it like **two people editing the same Excel spreadsheet offline, then merging their changes later**.

### Step 1: Each Ship Gets Its Own Copy
- When a new ship is onboarded, we create a **full copy** of that vessel's data from the office system
- This copy is loaded onto the ship's local server
- From that point, the ship crew uses their local system — no internet needed for daily work

### Step 2: Ship Crew Works Normally
- Engineers log running hours, complete work orders, consume spares — all on the local ship system
- Everything works exactly like it does today, but faster (no waiting for slow VSAT)
- The system quietly keeps a **list of what changed** in the background

### Step 3: "Sync Now" When Internet Is Available
- When the ship has a satellite connection, someone clicks **"Sync Now"**
- The system sends the ship's changes to the office server
- The office server sends back any changes the office staff made
- Both sides are now up to date

### Step 4: If the Connection Drops Mid-Sync
- The system **remembers where it stopped**
- Next time you click "Sync Now", it **picks up where it left off** — doesn't re-send everything from scratch
- No data is lost

---

## Who Can Change What

This is important because it determines how we handle disagreements between ship and office.

### Office-Only Changes (no conflict possible)
These things can **only be changed from the office**. The ship receives these changes during sync but cannot modify them:

- Adding or editing **equipment/components** in the machinery list
- Changing **job schedules** or maintenance frequencies
- Managing **fleet templates** (master components, jobs, spares)
- Approving or rejecting **Change Requests**
- Managing **ranks, org chart, user access permissions**
- **Verifying/closing defects** from the office side
- Certificate and survey **master definitions**

**Why this is simple:** Since only office can change these, there's never a disagreement. The ship just receives the latest version.

### Both Sides Can Change (conflict possible)
These things can be changed by **both ship crew and office staff**:

- **Work orders** — ship completes them, office can also approve/modify
- **Running hours** — ship updates daily, office may correct
- **Defects** — ship raises them, office updates status
- **Spare parts stock** — ship consumes, office may adjust
- **Stores inventory** — ship consumes, office may adjust
- **Change requests** — ship submits, both can add comments
- **Certificates & surveys** — both can update data
- **Documents/photos** — both can upload to work orders or defects

**Why this needs special handling:** See "What If Both Sides Change the Same Thing?" below.

---

## What If Both Sides Change the Same Thing?

This is the hardest part, and here's how we handle it:

### Scenario 1: Different fields — NO problem
> Ship engineer updates a work order's **status** to "Completed"
> Office superintendent updates the same work order's **approver** to "Chief Engineer"

Both changes apply automatically. They changed different fields, so there's no disagreement.

### Scenario 2: Same field — CONFLICT
> Ship engineer writes **"Replaced bearing"** in the work order remarks
> Office superintendent writes **"Pending inspection"** in the same remarks field

This is a conflict. The system cannot decide which one to keep, so it:
1. Flags it as a **conflict**
2. Shows both values side-by-side on the Sync Dashboard
3. A person (ship admin or office superintendent) **picks which one to keep** — or types a merged version
4. The resolution syncs to the other side on the next sync

### How often will conflicts happen?
**Rarely.** In practice, ship and office usually work on different fields. The ship fills in execution details while the office handles approvals. True same-field conflicts are exceptional.

---

## Documents and Photos

Documents (PDFs, photos, Excel files attached to work orders, defects, etc.) sync **separately** from the regular data:

1. **Regular data syncs first** — because it's small and critical (a few KB)
2. **Files sync after** — because they're large (1-10 MB each) and VSAT is slow
3. Files are **split into small pieces** — if the connection drops halfway through uploading a 5MB photo, next time it resumes from where it stopped, not from the beginning
4. **Small files go first** — a 50KB certificate syncs before a 5MB photo

---

## What the Ship Crew Sees

### Sync Dashboard (new screen)
A simple screen showing:
- Last synced: "2 hours ago"
- Pending changes: "12 records to send, 3 files to upload"
- Conflicts: "2 items need your decision"
- Connection: "Online" / "Offline"
- **[Sync Now]** button

### During Sync
A progress indicator:
> "Sending changes... 45 of 120 records"
> "Receiving office updates... 80 of 200 records"
> "Uploading files... 2 of 5 complete"

### Sync Icon in Header
A small icon always visible in the top bar:
- Green check = fully synced
- Spinning = sync in progress
- Yellow warning = you have unsynced changes
- Red = conflicts need attention

---

## What the Office Sees

### Fleet Sync Overview (new admin screen)
A table of all vessels:

| Vessel | Last Sync | Pending | Conflicts | Status |
|--------|-----------|---------|-----------|--------|
| V001 - Pacific Star | 30 min ago | 0 | 0 | Synced |
| V003 - Ocean Pride | 3 days ago | 45 | 2 | Attention needed |
| V007 - Sea Fortune | 12 hours ago | 8 | 0 | Pending |

This lets the superintendent quickly see which ships are up-to-date and which need attention.

---

## Safety and Reliability

| Concern | How We Handle It |
|---------|-----------------|
| What if the ship database crashes? | Office has a complete copy of all data. Re-provision the ship from office |
| What if the office database crashes? | All ships have their own data. Office restores from AWS backup. Ships re-sync |
| What if someone forgets to sync? | If a ship hasn't synced in 48 hours, office gets an alert notification |
| What if a conflict isn't resolved? | After 7 days, both sides get an escalation alert |
| Can we see the sync history? | Yes — full log of every sync: when, how many records, any errors |
| Is the data encrypted during transfer? | Yes — all sync communication over HTTPS (encrypted in transit) |
| Can an unauthorized person trigger sync? | No — each ship has a unique API key that matches its vessel ID |

---

## Timeline Estimate

| Phase | What | Duration |
|-------|------|----------|
| 1 | Database preparation + table classification | ~1.5 weeks |
| 2 | Change tracking on editable tables | ~2 weeks |
| 3-4 | Sync engine + API (core logic) | ~4.5 weeks |
| 5 | File/document sync | ~2 weeks |
| 6 | First-time ship setup (provisioning) | ~1 week |
| 7-8 | Ship dashboard + Office admin screen | ~2.5 weeks |
| 9 | Cleanup routines + monitoring | ~3-4 days |
| | **Total** | **~12-14 weeks** |
