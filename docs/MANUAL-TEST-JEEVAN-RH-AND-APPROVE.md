# Manual test — 3 items (for Jeevan)

**Where to run this:** on the **DEV environment**, using the ship and shore servers you normally
access — **after the sync stack has been deployed to dev**. Check with Ghazi that the deploy has
landed before you start; testing against the old build proves nothing.

---

## ⚠️ STEP 0 — CONFIRM THE BUILD BEFORE YOU TEST ANYTHING

**Do this first. Every time. It takes a minute and it protects a day.**

On 27-Jul the dev server was found running a bundle from a *different folder* than the one being
updated: the repository looked current while the code actually serving requests was a week old. A
full round of testing was spent on code that was never live. This step exists so that cannot
happen again silently.

1. Stay logged into the app, then open this in a **new tab of the SAME browser** (the session
   cookie is what authorises it) — once for the **shore**, once for the **ship**:

   `/technical/api/sync/status?vesselId=<vessel-id>&instanceId=<instance-id>`

   Use the vessel and instance you are testing. If you do not know the instance id, the Sync
   Dashboard shows it.

2. In the JSON, find the **`build`** block. It looks like:
   `"build": { "commit": "700fa6cf6", "branch": "replit_dev", "startedAt": "...", "source": "git" }`

3. **Send Ghazi the `commit` and `startedAt` from BOTH ship and shore before you start testing.**
   - The two `commit` values should match each other, and match the build we asked you to test.
   - `startedAt` must be **after** the deploy. If it is earlier, the server was never restarted
     and everything you test is the old code.

4. If the page says **unauthorized**, or you cannot get a `build` value, **stop and ask Nilesh** —
   do not start testing. A missing build identity is itself the problem.

**If any result later looks impossible, suspect a stale build first and re-check this step.**

### The build can be right and the DATABASE still be wrong

A correct build with **un-run migrations** is a different failure: the code is new, but the
columns it expects do not exist yet. It looks like a bug and is not one.

**The tell:** at **CHECK 1**, if **"WO Completion RH" is missing from the form entirely, or is
permanently blank and never prefills**, that points at **migration 139 not having run** — not at a
form defect.

**How to tell the two apart:**
- `build.commit` is **OLD** → stale bundle → the code itself is out of date.
- `build.commit` is **CURRENT** but the field is missing or always blank → **the migrations have
  not run** against that database.

In either case: **stop and report it before continuing.** Do not work around it, and do not carry
on to the later checks — every result after that point would be meaningless.

---

**Why manual and not automated:** these flows depend on tab switching and form re-rendering,
which our test automation drives unreliably. Everything else in the pre-deploy check is already
verified — these need a human.

**Vessel:** use whichever vessel you normally test with, or the one Ghazi nominates. It must have
at least one **running-hours** based work order for Test 1 and at least one **calendar** based
work order for Test 3.

Having the ship and shore open in two windows side by side makes the "check both screens agree"
steps much easier.

**If anything below does not match the expected result, stop and report it — do not work around it.**

---

## TEST 1 — Running-hours work order (on the SHIP)

**What this checks:** the RH accuracy change (migration 139). Three specific behaviours.

### Pick the work order
1. Ship → **Work Orders**.
2. Open the **Due** or **Overdue** tab.
3. Open a work order whose maintenance is based on **Running Hours** — not Calendar.
   Its Part A shows a running-hours interval rather than a Months/Weeks frequency.
   *(If none exists, tell us and we will create one — do not convert a calendar job.)*
4. 🔴 **Its component must be RH Counter Type = MASTER, not INHERITED.**
   Check it at **Components → the component row → the "RH Counter Type" column** (also shown in
   the component's Running Hours panel). Pick one that reads **MASTER**.
   **Why:** INHERITED components currently show a stale running-hours figure on the SHORE — a
   known bug (see "correct, not a fault" below). If you test on one, you will see ship and shore
   disagree at CHECK 4 and conclude sync is broken when it is not.

### Fill Part B
5. Answer the three B1 safety questions. Use **NA** unless you are attaching documents —
   answering **Yes** requires an uploaded document and will correctly block the submit.
6. Enter **Start Date/Time** and **Completion Date/Time**.
7. **Performed By** must NOT be the same rank as the Approver. If the approver is Chief Engineer,
   pick someone else (e.g. 2nd Engineer). The system correctly refuses "same person performs and
   approves".
8. Enter **No. of Persons**. Total Time is calculated for you.
9. Fill **Work Carried Out**.

### ✅ CHECK 1 — "WO Completion RH" prefills and can be edited
10. Find **WO Completion RH** in Part B (section B2.1).
   - **Expected:** it already contains a running-hours figure when you open the form —
     it is not blank.
   - Type a different number into it.
   - **Expected:** it accepts your change. It must not be locked or read-only.

### ✅ CHECK 2 — the reading is validated against the READING date, not the completion date
11. Find **Current Reading** and **Current Reading Date** (section B3).
12. Set **Current Reading Date** to a date **a few days BEFORE** your Completion Date.
13. Enter a **Current Reading** that would be plausible on that *reading* date but too low for the
    later completion date.
    - **Expected: it is ACCEPTED.** The check is made against the Current Reading Date.
    - **This is the change:** previously it was judged against the completion date and a valid
      backdated reading was wrongly rejected.
14. Now enter an obviously impossible reading (e.g. far lower than the last recorded reading, or a
    huge jump).
    - **Expected: it is REJECTED with a clear message.** Validation still works — it is only the
      reference date that changed.

### ✅ CHECK 3 — the next due is calculated from WO Completion RH
15. Note the value in **WO Completion RH** and the running-hours interval from Part A.
16. Submit using the **"Submit Work Order"** button at the **BOTTOM** of the form.
    ⚠️ The **"Save"** button at the **top** only saves a draft. If the toast says *"Draft Updated"*
    and the status stays **Draft**, you pressed the top button.
    - **Expected toast:** *"Work order submitted for approval"*, status becomes **Pending Approval**.
17. Re-open the work order and look at **Next Due RH** (or Next Due Reading).
    - **Expected:** Next Due = **WO Completion RH + the interval**.
    - **NOT** based on the Current Reading you entered in B3. Those are two different numbers and
      this is the whole point of the change — if Next Due was computed from the Current Reading,
      that is a failure. Report it.

### ✅ CHECK 4 — it reaches the office
18. Ship → **Admin → Sync Dashboard** → press **Sync Now**. Wait for it to finish.
19. Shore → **Work Orders → Pending Approval**.
    - **Expected:** the same work order is listed, same number, status **Pending Approval**.
20. Open it on shore and confirm **WO Completion RH**, **Current Reading** and **Current Reading
    Date** all show the values you typed on the ship.

---

## TEST 2 — Office approval (on the SHORE)

**What this checks:** an office approval reaches the vessel.

1. Shore → **Work Orders → Pending Approval** tab.
2. Open the work order from Test 1 (or any work order in that tab).
3. Review it and **Approve** it.
   - **Expected:** a success message, and the work order leaves the Pending Approval tab.
4. Check the **Completed** tab.
   - **Expected:** the work order now appears there.
5. Ship → **Admin → Sync Dashboard** → press **Sync Now**. Wait for it to finish.
6. Ship → **Work Orders → Completed** tab.
   - **Expected:** the same work order now shows as approved/completed **on the ship too**,
     with the approver's name recorded.
7. **Both screens must agree.** If the ship still shows Pending Approval after a completed sync,
   stop and report it.

---

## TEST 3 — CALENDAR work order, Running Hours left UNTOUCHED (on either side)

**What this checks:** the "Internal server error" on submit reported 27-Jul. A calendar job sends
a **blank** WO Completion RH, and a blank value was reaching a numeric database column. This is the
exact case that was failing — and note it could NOT be worked around the way the RH job could,
because the WO Completion RH box is not shown on calendar jobs at all.

**Do this one FIRST if you are short of time** — it is the actual regression.

1. Open a work order whose maintenance is based on **Calendar** — a Months/Weeks/Years frequency,
   not running hours.
2. Fill Part B exactly as in Test 1 (B1 questions, dates, Performed By, No. of Persons,
   Work Carried Out).
3. 🔴 **Leave section B3 Running Hours COMPLETELY EMPTY.** Do not type a Current Reading, do not
   set a Current Reading Date, do not press Fetch RH. Leaving it blank is the whole point of the
   test.
4. Press **"Submit Work Order"** at the **BOTTOM** of the form.

### ✅ CHECK 5 — it submits without an error
   - **Expected:** *"Work order submitted for approval"*, status becomes **Pending Approval**.
   - **A red "Internal server error" toast is a FAIL — report it immediately with the time,
     to the minute.** That timestamp is what lets us find the matching line in the server log.

### ✅ CHECK 6 — it still works when RH IS filled in
5. Repeat on a second calendar work order, but this time DO enter a Current Reading and
   Current Reading Date in B3.
   - **Expected:** also submits cleanly.
   - Both must pass. Filling B3 on a calendar job is legitimate — many calendar jobs sit on
     equipment that has a running-hours counter, and recording the reading during the job is
     deliberate, not a mistake.

---

## What to send back

For each ✅ CHECK: pass or fail, and for a fail, a screenshot plus what you expected versus what
you saw. Also note anything that felt wrong even if it technically passed.

## Things that are CORRECT and not faults

- *"Risk Assessment is marked as Yes but no supporting document has been uploaded"* — answer NA or
  attach the document.
- *"The Head of Department cannot both perform and approve the work"* — pick a different performer.
- Pressing the **top Save** with required fields missing saves a **draft**; it does not submit.
- The Sync Dashboard's conflict panel may say *"N conflicts need review"* with a link — that is the
  new correct wording, not an error.
- **On the SHORE, an INHERITED component may show an OLD running-hours figure** while the ship
  shows the new one. A number of components are affected. The root cause is found and the fix is
  queued — the shore does not currently update the cached figure that this screen displays.
  **Do not raise this separately, and please do not try to count how many are affected** — note
  the component code you happened to hit and move on. It is NOT a sync failure, and the work
  order itself syncs correctly.
  ⚠️ **A freshly-provisioned vessel will show ZERO stale components** — do NOT read that as
  "the bug is fixed". The staleness only appears AFTER a master component's running-hours reading
  is entered and synced; a clean provision copies master and cached figures together, so there is
  nothing stale to see yet. To observe the bug at all, complete an inherited-component RH reading,
  sync it, then look at the master's inherited children on shore.
- **Some equipment demands a running-hours entry even though it is marked "Not RH Driven".**
  This is a KNOWN BUG already queued for fixing — the counter type is stored as `NOT RH DRIVEN`
  (with spaces) on about 30 components on dev, while the system checks for `NOT_RH_DRIVEN` (with
  underscores), so those components are never recognised as non-RH. **Please do not raise this
  separately** — note which component it was and move on.
- The Sync Dashboard may report **"Sync finished WITH ERRORS"** in amber, or show a non-zero
  **"Still to send"**. Neither means data was lost — undelivered records now stay queued and retry
  instead of being silently dropped. Only report it if the same count keeps climbing across
  several syncs.

🔴 **IF A SYNC LOOKS STUCK, OR A COUNT KEEPS CLIMBING — REPORT IT AND STOP THERE.**
Do **NOT** reset anything, re-offer records, clear a queue, or retry a recovery action. Recovery
operations are **FROZEN** until the deploy is confirmed on every instance. Re-sending old records
before all instances are updated is exactly how data was lost previously. Reporting it is the
correct and complete action — someone else will decide what to do.
