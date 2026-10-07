---
name: Component UAT writing standard
description: Keep Component test instructions simple and direct for domain-team testers.
---

Component UAT steps must use short, numbered actions in plain English, with one action per step. Use instructions such as “Open PMS,” “Click Components,” “Select the test vessel,” and “Check whether the component tree loads.” Add a separate Example column with a sample action or input and its outcome.

**Why:** The domain team needs instructions they can follow directly. The user rejected long “Preparation,” “Carry out the case,” and “Check and record” paragraphs even when they contained more detail.

**How to apply:** Keep setup detail in Preconditions and Test Data, keep outcomes in Expected Result, and make the numbered Test Steps a clear action sequence. Retain scenario-specific checks and safe test-fixture constraints; do not replace them with generic instructions.
