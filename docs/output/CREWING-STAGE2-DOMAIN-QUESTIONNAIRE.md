# Crewing chatbot — live data: decisions needed

For **Sahil and Sagar Chadda** · prepared 21-Oct-2026 by support · **revision 3**, aligned with the reusable-tool design and its pilot trial.

## What this is about

The Crewing chatbot can now answer live questions in a trial, for example:
- "who is on board MV X";
- "which engineers have certificates expiring in 60 days";
- "how many crew per vessel".

It works from **one fixed meaning per word**. Where the Crewing code is clear, we used it. Only the questions below are genuinely unclear: the code contradicts itself, or says nothing.

Each question shows the meaning **used in the trial** (provisional, not approved) and an example. Please answer **A / B** or write your own. It takes about 10 minutes.

**Scope.** These seven decisions cover **only the two trial areas**: crew on board, and licence / training-certificate expiry. Every other data area (relief, rest hours, rotation, appraisals, crew pool, manning) will need **its own short, targeted list** before it is built. The "Later" section below only gives a first view of those.

**How your answers are used.** Each approved meaning becomes **one rule in the Crewing server**, used by every question that relies on it. For example, "engineers" is now a named group on the server, so it always means the same ranks. The assistant cannot redefine a word. One limit remains: the assistant still decides which kind of document the user *meant* by their wording (decision 2). Clear meanings and tests reduce that risk but cannot remove it completely.

---

## 1. Does a *secondary* assignment count as "on board"?

Crewing records a second, "secondary" assignment for some people, for example a Third Engineer also listed on a second vessel.
- **Vessel screen crew count:** includes secondary assignments.
- **"Crew on board" report:** applies no rule at all; it also lists people who have not signed on yet.

**Example:** Faustin is primary on MV Alpha Star and secondary on MV Beta Ocean.
- Counting secondary (A): Beta Ocean has **7** on board.
- Not counting it (B): Beta Ocean has **6**.

**Trial used:** A, the same as the Vessel screen. **Decision:** A / B

## 2. When a user says "certificates", what is included?

Crewing keeps two kinds:
- **licences / certificates** (CoC, endorsements, GMDSS…);
- **training-course certificates** (Basic Safety, Advanced Fire Fighting…).

**Example:** "How many crew have a licence or certificate expiring in 30 days?" gives **4** crew counting licences only, but **7** counting both.

**Trial used:** both, unless the user names one kind ("licences", "courses"). In the trial, the word "licence" in the question sometimes made the assistant count licences only.

**Decision:** "certificates" = **A** both kinds / **B** licences only

## 3. "Expiring soon" without a period

**Trial behaviour:** the assistant **asks** which period. When the user gives one, it uses it exactly: 60 days and 2 calendar months are different windows. From 1 Nov, 60 days ends 31 Dec; 2 months ends 1 Jan.

**Decision:**
- **A** keep asking;
- **B** use a default of: 30 days / 60 days / 2 calendar months (pick one).

## 4. Expired documents

**Trial used:** "expiring" excludes documents that have **already expired**. "Expired" is a separate question with a separate answer.

**Decision:** OK / list expired ones together with expiring ones

## 5. Rank groups: "engineers", "officers", "ratings"

The rank categories stored in Crewing are inconsistent: "Senior Officers" includes Able Seaman and Wiper. So the trial uses this **provisional** list:

| Group | Ranks |
|---|---|
| Deck officers | Master, Chief Officer, Second Officer, Third Officer |
| Engineers (engine officers) | Chief / Second / Third / Fourth / Fifth Engineer, Electrical Officer, Gas Engineer |
| Deck ratings | Bosun, Able Bodied Seaman, Ordinary Seaman, Pumpman |
| Engine ratings | Fitter, Motorman, Oiler, Wiper |
| Catering | Chief Cook, Messman |
| Cadets | Deck Cadet, Engine Cadet |

"Officers" = deck officers + engineers. "Ratings" = deck + engine ratings.

**Decision:** correct the list where needed. Is the Electrical Officer an "engineer"? When someone says "engineers", do they ever mean engine ratings too (Fitter, Motorman, Oiler, Wiper)? The trial uses **engine officers only**.

## 6. Whose documents count?

**Trial used:**
- **Excluded:** archived licences, and archived or deleted crew. The current reports include them.
- **Included:** crew who are not on board (on leave, planned joiners), unless the user says "on board".
- **Not yet decided:** inactive and terminated crew who are **not** archived. The trial includes them.

**Decision:** for "expiring certificates", include terminated / inactive crew? Yes / No

## 7. What an answer may show

**Trial shows:**
- name, rank and vessel;
- document name and expiry date, or sign-on date;
- counts.

**Never shown:** passport, visa and certificate numbers, date of birth, contact details, medical or D&A results, wages.

**Decision:** OK / remove or add a field

---

## 8. Worked examples (needed for testing)

For each area, please give **2 real cases from dev data** with the answer you expect. For example: "MV ___ on 1-Nov: on board = __ people; ___'s CoC expires __ → expiring in 60 days."

We test the chatbot against **your** examples first. If a Crewing screen disagrees, we report the difference to you instead of choosing one ourselves.

## Later (not needed now)

These are needed before those areas are built; no answer is needed today:
- **Relief due:** Due Crew screen (contract end, months) or the relief-due date (days)?
- **Rest hours:** live or stored counts; default mode (rest/work) and OPA default.
- **Appraisals:** does "pending" include drafts?
- **Rotation approvals:** all pending plans, or only those waiting for the person asking?
- **Terminated:** status starting "Terminated" (covers UT/BT/General/NFR)?
