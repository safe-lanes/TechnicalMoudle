# Windows dev checkout: `npm install` drops the Windows-only native binaries

**Symptom (PROVEN 23-Sep-2026, chatbot-enterprise, Windows 11, Node 22.13.1 / npm 10):** after any
`npm install <package>` on a Windows checkout, the dev server fails to start with

```
Error: Could not load the "sharp" module using the win32-x64 runtime
```

and the Vite/Rollup Windows binary is gone as well. On 23-Sep this happened while installing
`remark-gfm@4.0.1` (the assistant widget's Markdown-table plugin); npm reported "added 18 packages,
and removed 2 packages" — the two removed were `@img/sharp-win32-x64` and
`@rollup/rollup-win32-x64-msvc`.

**Why:** `package-lock.json` is generated on Linux (Replit / the deploy hosts). It lists the Linux
platform packages (`@img/sharp-linux-x64`, …) but **no `win32` optional packages**
(`grep -c '"node_modules/@img/sharp-win32-x64"' package-lock.json` → 0). Any npm operation that
reconciles `node_modules` against the lockfile therefore prunes the Windows binaries that an earlier
manual reinstall had put there. This is a property of the lockfile + platform, not of the package being
installed.

**Production is unaffected (PROVEN 23-Sep-2026).** The deploy targets are Linux. A clean `npm ci` from
the committed `package.json` + `package-lock.json` (commit 318df2a8f) in a fresh `node:22-bookworm-slim`
container (node v22.23.2, npm 10.9.8, empty `node_modules`) installed 701 packages; `remark-gfm` 4.0.1
resolves, `require("sharp")` loads, and the platform packages present are
`@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64` (+ musl variants) and
`@rollup/rollup-linux-x64-gnu` / `-musl`. No win32 packages — which is exactly why the Windows repair
below is needed on a developer machine and nowhere else.

**Repair on Windows (after every `npm install` / `npm ci`):**

```bash
npm install --no-save --no-audit --no-fund \
  "@img/sharp-win32-x64@$(node -p "require('./node_modules/sharp/package.json').version")" \
  "@rollup/rollup-win32-x64-msvc@$(node -p "require('./node_modules/rollup/package.json').version")"
```

`--no-save` keeps `package.json` and `package-lock.json` untouched (verify with `git status`). Do NOT
commit a lockfile regenerated on Windows: it would add win32 entries and, worse, risk the Replit
package-firewall poison (`grep -c package-firewall.replit.local package-lock.json` must stay 0).

**Not fixed here (would be a separate decision):** making the lockfile platform-complete
(`npm install --os=win32 --cpu=x64 …` on Linux, or `supportedArchitectures` in `.npmrc`) so both
platforms install cleanly without the repair step.
