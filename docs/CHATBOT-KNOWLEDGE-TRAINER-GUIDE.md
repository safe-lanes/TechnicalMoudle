# Training the chatbot — guide for trainers

*For Jeevan (Technical). Other modules' trainers follow the same steps in their own module once it is connected.*

## Open the knowledge screen

1. Log in to **SAILERP dev** as usual and open **Technical**.
2. Open the **chatbot**.
3. Click the **book icon** at the top of the chatbot ("Manage knowledge"). Only trainers see it.
4. The knowledge screen opens in a new tab, already signed in as you, showing your module.

## Your drafts

Five drafts are waiting for your review. Development prepared them from the application and its tests; you have not
confirmed them yet:

- Deleting a job
- Deactivating a component
- Running Hours (RH) counter types
- Running Hours (RH) validations when updating RH
- Updating the running hours of one component (Gear icon)

Open each one, correct anything that is wrong, and answer the points marked **Needs expert confirmation**.

## Train the chatbot

1. Open a draft, or click **New entry** and choose the type (Procedure, FAQ, Validation rules, Scenario explanation or
   Correction).
2. Write the guidance in simple steps. Fill in who it applies to, and the evidence (manual page, application, or your
   own confirmation).
3. Click **Save draft**. Only you can see a draft.
4. **Test draft:** type the question the way a user would ask it. The chatbot answers privately with your draft in
   place; nobody else sees this answer. Test draft covers how-to, procedure and rule questions, not live data such as
   work order counts.
5. When the answer is right, click **Publish for all clients and environments**. Publishing is refused while a point
   still needs confirmation.
6. Publishing updates the chatbot straight away for this module's users of all clients, in dev and production. No
   release or deployment is needed for each entry. Ask the question in the normal chatbot to see the result.

## Later

- **Edit and publish again** to change an entry. Each publish is a new revision.
- **History → Restore** goes back to an earlier revision.
- **Retire** (click twice) stops the chatbot using an entry.
- **Review queue:** answers that users flagged with **Report this answer**. Use **Create entry from this** to fix one.
  A report never changes the chatbot by itself.

## Please remember

- Every entry goes to **all clients**, so write general guidance only: no vessel names, people or client figures.
- If the guidance depends on a setting or version, write it under **Conditions** (for example "only when RH validation
  is ON").
