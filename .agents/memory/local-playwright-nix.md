---
name: Local Playwright on Nix
description: Use the system Chromium wrapper for direct shell browser checks in this workspace.
---

When running Playwright directly from the shell, launch Chromium with `executablePath: "/repl/tools/bin/chromium"` rather than the default downloaded headless browser.

**Why:** The downloaded Playwright headless shell failed to launch because `libglib-2.0.so.0` was unavailable on its default library path. The system Chromium wrapper runs correctly in the Nix environment.

**How to apply:** Use this for lightweight, direct browser checks. It does not change the testing subagent's browser setup, and requires no browser package installation or project dependency changes.