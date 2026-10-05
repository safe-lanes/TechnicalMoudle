# Chatbot knowledge — guide (pilot, updated 5 Oct 2026)

Two parts:
- **Part A** — for the administrator who decides who may train the chatbot.
- **Part B** — for trainers (for example Jeevan, for Technical).

*Pilot only: nothing here is live.*

**How training works (decided 1 Oct 2026):**
- Trainers are **SAIL staff**.
- A trainer trains **one module** (for example Technical) for **all clients**.
- Training is done on **dev**. There is **one assistant** for dev and production.
- **Publishing for all clients and environments is a policy we chose, not a technical necessity.** The assistant can keep
  guidance separate per company or environment; we decided not to. So **"Publish for all clients and environments"
  makes the guidance available to the chatbot for every client, in dev and production, at once**.
- **This pilot is isolated.** It has its own copy of the chatbot's documents and its own service, and nothing published
  in it reaches the real production chatbot.

---

## Part A — Assigning and removing trainers (administrator)

### How the system knows who is a trainer (updated 5 Oct 2026)

- **Training happens on dev only.** Dev is our own SAILERP, with one login for all modules (Technical, Crewing,
  Audit & Safety). Trainers have no login on a client's production.
- **The trainer list** is kept by the assistant on the AI server. Each row holds:
  - the **user id** (the person's SAILERP dev login);
  - a name;
  - the **module** they train;
  - the module's **dev system**, filled in automatically, for example `technical-dev`;
  - active or inactive.
  The **company is not used.**
- **The check:** when someone opens "Manage knowledge" from the chatbot, PMS sends the assistant a signed note naming
  the system and the SAILERP user id from the verified login. None of this can be faked in the browser. The person can
  train a module only if an **active** row exists with **that dev system and that user id**.
- **What gets nothing:**
  - **any login from production**, even with the same user id: nobody on production is ever a trainer;
  - a module the person is not listed for (a Technical trainer cannot train Crewing).
- **Roles:** no role is involved. Being a Sail Admin does not make someone a trainer.
- **One module per row.** Example:
  - Jeevan → Technical;
  - the crewing trainer → Crewing;
  - the audit trainer → Audit.
- **Modules not yet connected:** a trainer can be added only for a module whose dev system is connected to the
  assistant. Today that is **Technical only**. On the page, Crewing and Audit show "dev not connected yet". Connecting
  them needs two things: the module's dev address registered on the assistant (same dev base address, with the
  module's path), and that module sending the verified login to the assistant, as Technical does.
- **When changes apply:** adding, deactivating or reactivating applies on the trainer's **next click**, even in a screen
  that is already open. The history of every change is kept.

### Option 1 — the Trainers page (on the AI server)

1. **Open it.** The page is at `/admin/kb` on the assistant. It is **not reachable from the internet**; open it on the AI
   server, for example through the SSH tunnel: `http://localhost:18047/admin/kb`.
2. **Enter the assistant's admin token.** For the pilot it is the `ADMIN_TOKEN` line in
   `~/central-assistant/kbpilot-r8.env` on the AI server. The pilot has its **own** token; it does not reuse the live
   service's.
3. **Add a trainer.**
   1. Type a name or user id in **Find a person**. The list shows people who have used the chatbot.
   2. Pick one, and the user id and name are filled in. If the person has never used the chatbot, type their SAILERP dev
      user id yourself (for example `Jeevan`).
   3. Choose the **module**.
   4. Fill in **Granted by** and click **Add trainer**.
   The dev system is chosen automatically. The confirmation names it, for example "signs in on technical-dev".
4. **The list** shows every trainer with module, dev system and status. **Deactivate** removes access at once;
   **Reactivate** gives it back. Tick **Show inactive** to see the history.

### Option 2 — the command (same result)

The commands run on the AI server, inside the pilot container:

```bash
docker exec sail-assistant-py-kbpilot python -m app.kb_admin list            # add --all for inactive ones
docker exec sail-assistant-py-kbpilot python -m app.kb_admin grant   --user Jeevan --module technical --name "Jeevan" --by "Ghazi"
docker exec sail-assistant-py-kbpilot python -m app.kb_admin revoke   --user Jeevan --module technical --by "Ghazi"
```

### Finding a user id when the person has not used the chatbot

The PMS server logs it each time the person opens the chatbot: `[assistant-api] mint user=<id>`. It is also in the
`master_users` table of the dev PMS database.

---

## Part B — Using the knowledge screen (trainer)

### Open it

1. Open the PMS chatbot.
2. Click the **book icon** ("Manage knowledge"). It is shown only to trainers.
3. The screen opens in a new tab, signed in as you, and shows **only the modules you train**.

### The flow

1. **New entry** (or open an existing one). Choose the type: Procedure, FAQ, Validation rules, Scenario explanation or
   Correction. Every entry applies to **all clients** and **all environments**.
2. Write the guidance in plain steps. Add who it applies to, the supporting **evidence** (Manual-derived,
   Code-verified, Expert-confirmed) and any **points needing expert confirmation**.
3. **Save draft.** It keeps your changes; nobody else sees a draft.
4. **Test draft.** Type the question as a user would. The chatbot answers the way it answers users' **documentation
   ("how do I…") questions**, with your draft in place. It does **not** cover live-data questions (work-order counts, due
   lists and similar), which need the user's own data access. Only you see this test. The green line tells you whether
   your draft was used.
5. **Publish for all clients and environments.** This revision becomes **available to the chatbot** for every client, in
   dev and production, at once. The chatbot uses it when it finds it relevant to a question; publishing does **not**
   guarantee that every answer will use it, so check important questions with Test draft first. Publishing is refused
   while a point still needs confirmation.
6. **Later:**
   - **Edit and Publish again** to change it (a new revision);
   - **History → Restore** to go back to an earlier revision;
   - **Retire** (two clicks) to stop using the entry.

### Writing guidance that goes to every client

- **Conditions.** If the guidance depends on a setting, configuration or application version, write it in
  **Conditions** / **Application version** (for example "only when the vessel's RH validation is ON").
- **No client data.** When you start an entry from a user's report, write general guidance. Do **not** copy
  client-specific data (vessel names, people, figures) from the report, because the entry is published for all
  clients.

### Other parts of the screen

- **Review queue.** "Report this answer" items from users of all clients, for your module. **Create entry from this**
  links a new entry to the report; **Close** closes it. A report never changes the chatbot by itself.
- **Replaces manual passages.** While your entry is published, the chatbot stops using the passages you pick. Retiring
  the entry brings them back.
- **Internal notes.** Never shown to chatbot users.

### Your drafts in the pilot (Technical)

These were prepared by development from the application code and tests. You did not author or confirm them, and their
history says so. The points that need your confirmation are inside each one:

- Deleting a job
- Deactivating a component
- Running Hours (RH) counter types
- Running Hours (RH) validations when updating RH
- Updating the running hours of one component (Gear icon): a correction of the manuals' note on Inherited RH
