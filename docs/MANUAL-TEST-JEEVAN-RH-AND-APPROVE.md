# Manual test — 2 items (for Jeevan)

**Where to run this:** on the **DEV environment**, using the ship and shore servers you normally
access — **after the sync stack has been deployed to dev**. Check with Ghazi that the deploy has
landed before you start; testing against the old build proves nothing.

**Why manual and not automated:** these two flows depend on tab switching and form re-rendering,
which our test automation drives unreliably. Everything else in the pre-deploy check is already
verified — these two need a human.

**Vessel:** use whichever vessel you normally test with, or the one Ghazi nominates. It must have
at least one **running-hours** based work order for Test 1.

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

### Fill Part B
4. Answer the three B1 safety questions. Use **NA** unless you are attaching documents —
   answering **Yes** requires an uploaded document and will correctly block the submit.
5. Enter **Start Date/Time** and **Completion Date/Time**.
6. **Performed By** must NOT be the same rank as the Approver. If the approver is Chief Engineer,
   pick someone else (e.g. 2nd Engineer). The system correctly refuses "same person performs and
   approves".
7. Enter **No. of Persons**. Total Time is calculated for you.
8. Fill **Work Carried Out**.

### ✅ CHECK 1 — "WO Completion RH" prefills and can be edited
9. Find **WO Completion RH** in Part B (section B2.1).
   - **Expected:** it already contains a running-hours figure when you open the form —
     it is not blank.
   - Type a different number into it.
   - **Expected:** it accepts your change. It must not be locked or read-only.

### ✅ CHECK 2 — the reading is validated against the READING date, not the completion date
10. Find **Current Reading** and **Current Reading Date** (section B3).
11. Set **Current Reading Date** to a date **a few days BEFORE** your Completion Date.
12. Enter a **Current Reading** that would be plausible on that *reading* date but too low for the
    later completion date.
    - **Expected: it is ACCEPTED.** The check is made against the Current Reading Date.
    - **This is the change:** previously it was judged against the completion date and a valid
      backdated reading was wrongly rejected.
13. Now enter an obviously impossible reading (e.g. far lower than the last recorded reading, or a
    huge jump).
    - **Expected: it is REJECTED with a clear message.** Validation still works — it is only the
      reference date that changed.

### ✅ CHECK 3 — the next due is calculated from WO Completion RH
14. Note the value in **WO Completion RH** and the running-hours interval from Part A.
15. Submit using the **"Submit Work Order"** button at the **BOTTOM** of the form.
    ⚠️ The **"Save"** button at the **top** only saves a draft. If the toast says *"Draft Updated"*
    and the status stays **Draft**, you pressed the top button.
    - **Expected toast:** *"Work order submitted for approval"*, status becomes **Pending Approval**.
16. Re-open the work order and look at **Next Due RH** (or Next Due Reading).
    - **Expected:** Next Due = **WO Completion RH + the interval**.
    - **NOT** based on the Current Reading you entered in B3. Those are two different numbers and
      this is the whole point of the change — if Next Due was computed from the Current Reading,
      that is a failure. Report it.

### ✅ CHECK 4 — it reaches the office
17. Ship → **Admin → Sync Dashboard** → press **Sync Now**. Wait for it to finish.
18. Shore → **Work Orders → Pending Approval**.
    - **Expected:** the same work order is listed, same number, status **Pending Approval**.
19. Open it on shore and confirm **WO Completion RH**, **Current Reading** and **Current Reading
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
