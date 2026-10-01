# Chatbot knowledge — guide (pilot, updated 1 Oct 2026)

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

### How the system knows who is a trainer

- **The trainer list:** the assistant keeps it on the AI server. Each row holds:
  - the **issuer**, i.e. the application instance the trainer signs in through (for training: the dev instance);
  - the **company** they log in with;
  - the **user id**;
  - a name, a module, and active/inactive.
- **The check:** when someone opens "Manage knowledge" from the chatbot, PMS sends the assistant a signed note naming
  the issuer, the company and the SAILERP user id from the verified login. None of these can be faked in the browser.
  The assistant looks up a row where **issuer + company + user id all match**. If an **active** row exists for a module,
  the person can train that module; otherwise they are refused.
- **What gets nothing:**
  - the same user id in another company;
  - the same user id through another environment (issuer).
- **Roles:** no role is involved. Being a Sail Admin does not make someone a trainer.
- **When changes apply:** adding, deactivating or reactivating applies on the trainer's **next click**, even in a screen
  that is already open. The history of every change is kept.

### Option 1 — the Trainers page (on the AI server)

1. **Open it.** The page is at `/admin/kb` on the assistant. It is **not reachable from the internet**; open it on the AI
   server, for example through the SSH tunnel: `http://localhost:18047/admin/kb`.
2. **Enter the assistant's admin token.** For the pilot it is the `ADMIN_TOKEN` line in
   `~/central-assistant/kbpilot-r8.env` on the AI server. The pilot now has its **own** token; it no longer reuses the
   live service's.
3. **Add a trainer.**
   1. Type a name, user id or company in **Find a person**. The list shows people who have used the chatbot.
   2. Pick one, and the user id, name and company are filled in. If the person has never used the chatbot, type the
      SAILERP user id and company yourself.
   3. Choose the **module**.
   4. Leave **Signs in through** on the dev instance, because training happens on dev.
   5. Fill in **Granted by** and click **Add trainer**.
4. **The list** shows every trainer with module and status. **Deactivate** removes access at once; **Reactivate** gives
   it back. Tick **Show inactive** to see the history.

### Option 2 — the command (same result)

The commands run on the AI server, inside the pilot container:

```bash
docker exec sail-assistant-py-kbpilot python -m app.kb_admin list            # add --all for inactive ones
docker exec sail-assistant-py-kbpilot python -m app.kb_admin grant \
  --issuer technical-dev --tenant <login company> --user <SAILERP user id> --module technical --name "Smith" --by "Ghazi"
docker exec sail-assistant-py-kbpilot python -m app.kb_admin revoke \
  --issuer technical-dev --tenant <login company> --user <SAILERP user id> --module technical --by "Ghazi"
```

### Finding a user id when the person has not used the chatbot

The PMS server logs it each time the person opens the chatbot: `[assistant-api] mint user=<id>`. It is also in the
`master_users` table of their company's PMS database.

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
