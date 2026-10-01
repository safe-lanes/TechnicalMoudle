# Chatbot knowledge — guide (pilot, 1 Oct 2026)

Two parts:
- **Part A** — for the administrator who decides who may train the chatbot.
- **Part B** — for trainers (for example Jeevan, for Technical).

*Pilot only: nothing here is live.*

---

## Part A — Assigning and revoking trainers (administrator)

### What a trainer grant is

Chat access is unchanged: it stays under the existing policy (Sail Admin). **Knowledge management** is a separate grant,
for **one module**, given to **one person**, identified by three things that must all match the person's login:

| Field | Meaning | Example |
|---|---|---|
| issuer | The application **environment** the trainer signs in through (registered instance) | `technical-prod` (production) · `technical-dev` (dev) |
| company | The trainer's company (tenant domain of the login) | `wk` |
| user id | The trainer's SAILERP user id | `12345` |
| module | The one module the grant is for | `technical` |
| scope | `company` = may publish for **their own company only** · `global` = may publish **product-wide** guidance (all companies) | `global` for Jeevan |
| share across environments | Optional. May publish guidance that applies in **all** environments (dev + production). Off by default | off |

**Matching rules:**
- **No role grants access.** Being a Sail Admin does not make someone a trainer.
- **Same user id elsewhere gets nothing.** The same user id in another company, or in another environment, does not
  inherit the grant.
- **One grant per module.** A Technical grant gives nothing in Crewing, Audit or any other module.
- **Several people per module.** Any number of people may hold grants for the same module. They can all edit and
  publish that module's entries; no separate approver is needed.

### Commands

The commands run on the AI server, inside the assistant container. For the pilot, that container is
`sail-assistant-py-kbpilot`.

```bash
# who is a trainer (add --all to include revoked grants)
docker exec sail-assistant-py-kbpilot python -m app.kb_admin list

# grant Technical, product-wide, to one person on one environment
docker exec sail-assistant-py-kbpilot python -m app.kb_admin grant \
  --issuer technical-prod --tenant <company> --user <SAILERP user id> --module technical \
  --scope global --name "Jeevan …" --by "Ghazi" --note "Technical PIC"

# company-only trainer
… grant … --scope company …

# revoke (takes effect on the trainer's NEXT click — even in a screen that is already open)
docker exec sail-assistant-py-kbpilot python -m app.kb_admin revoke \
  --issuer technical-prod --tenant <company> --user <SAILERP user id> --module technical --by "Ghazi"
```

**Behaviour of these commands:**
- **Changing a grant:** granting again with a different scope replaces the old grant. The history keeps both.
- **Two environments:** someone who trains on two environments needs one grant per environment (issuer).
- **Shared guidance:** add `--share-envs` only when that person must be able to publish guidance shared by dev and
  production.
- **Where it is stored:** grants live in the assistant's own database (`kb_trainers`), with who granted or revoked them
  and when. No restart is needed.

### Finding the values

- **user id:** the SAILERP user id. The PMS server logs it each time the chatbot is opened (`[assistant-api] mint user=…`).
- **company:** the login's tenant domain.
- **issuer:** the environment's registered instance (`technical-dev`, `technical-prod`, `technical-demo`).

---

## Part B — Using the knowledge screen (trainer)

### Open it

1. Open the PMS chatbot.
2. Click the **book icon** ("Manage knowledge") at the top. It is shown only to trainers.
3. The knowledge screen opens signed in as you. It shows your company and environment (for example
   "Jeevan · wk · prod") and **only the modules you train**.

### The flow

1. **New entry** (or open an existing one). Choose:
   - the type: Procedure, FAQ, Validation rules, Scenario explanation or Correction;
   - **Companies:** all companies, or my company only;
   - **Environment:** this environment only, or shared by all environments (only if your grant allows it).
2. Write the guidance in plain steps. Add who it applies to, the supporting **evidence** (Manual-derived,
   Code-verified, Expert-confirmed) and any **points needing expert confirmation**.
3. **Save draft.** It keeps your changes; nobody else sees a draft.
4. **Test draft.** Type the question as a user would. The chatbot answers **the same way it answers users**, but with
   your draft in place. Only you see this test. The green line tells you whether your draft was used.
5. **Publish.** This revision becomes the chatbot's answer for users. Until then they keep the previous published
   version. Publishing is refused while a point still needs confirmation.
6. **Later:**
   - **Edit and Publish again** to change it (a new revision);
   - **History → Restore** to go back to an earlier revision;
   - **Retire** (two clicks) to stop using the entry.

### Other parts of the screen

- **Review queue.** Users' "Report this answer" items for your module, company and environment. **Create entry from
  this** links a new entry to the report; **Close** closes it. A report never changes the chatbot by itself.
- **Replaces manual passages.** While your entry is published, the chatbot stops using the passages you pick, for your
  companies and environment only. Retiring the entry brings them back.
- **Internal notes.** Never shown to chatbot users.

### Your drafts in the pilot (Technical)

These were prepared by development from the application code and tests. You did not author or confirm them, and their
history says so. The points that need your confirmation are inside each one:

- Deleting a job
- Deactivating a component
- Running Hours (RH) counter types
- Running Hours (RH) validations when updating RH
- Updating the running hours of one component (Gear icon): a correction of the manuals' note on Inherited RH
