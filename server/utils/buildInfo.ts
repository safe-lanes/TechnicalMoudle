/**
 * Build identity — which commit is this instance actually running?
 *
 * WHY (Frontier Venture rollout, 2026-07-24): the sync guards that make recovery safe emit diag
 * lines ONLY when they fire, so on a quiet vessel there is no log evidence either way. The only
 * positive proof a fix was live was SSH-ing to the vessel and reading `git log -1`. Ships are
 * intermittently reachable — FV was unreachable for days — so "is this vessel patched?" could not
 * be answered when it mattered most.
 *
 * This exposes build identity two ways: an unconditional startup log line, and GET /sync/status.
 * The endpoint is the one that counts — it is reachable through the app, so a vessel can be
 * confirmed WITHOUT shell access, which is the actual operational constraint.
 *
 * Resolution order: git (ships auto-pull, so .git is present) → env (for builds without a working
 * tree) → 'unknown'. Resolved ONCE and cached; never throws, never blocks startup.
 */
import { execSync } from 'child_process';

export interface BuildInfo {
  /** Short commit hash, e.g. "07d697f12". 'unknown' if unresolvable. */
  commit: string;
  /** Branch name, e.g. "replit_dev" / "production". 'unknown' if unresolvable. */
  branch: string;
  /** ISO timestamp of when THIS process started (not when the build was made). */
  startedAt: string;
  /** Where commit/branch came from — makes an 'unknown' diagnosable rather than mysterious. */
  source: 'git' | 'env' | 'unknown';
}

let cached: BuildInfo | null = null;

/** Short-timeout git read. Must never hang or throw — startup depends on it. */
function tryGit(args: string): string | null {
  try {
    const out = execSync(`git ${args}`, {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'], // swallow git's stderr; absence of .git is not an error here
    });
    const v = out.trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function getBuildInfo(): BuildInfo {
  if (cached) return cached;

  const startedAt = new Date().toISOString();
  const gitCommit = tryGit('rev-parse --short HEAD');
  const gitBranch = tryGit('rev-parse --abbrev-ref HEAD');

  if (gitCommit) {
    cached = { commit: gitCommit, branch: gitBranch || 'unknown', startedAt, source: 'git' };
    return cached;
  }

  // No working tree (packaged build) — accept the usual CI-injected names.
  const envCommit = process.env.BUILD_COMMIT || process.env.GIT_COMMIT || process.env.SOURCE_VERSION;
  const envBranch = process.env.BUILD_BRANCH || process.env.GIT_BRANCH;
  if (envCommit) {
    cached = { commit: envCommit.slice(0, 9), branch: envBranch || 'unknown', startedAt, source: 'env' };
    return cached;
  }

  cached = { commit: 'unknown', branch: 'unknown', startedAt, source: 'unknown' };
  return cached;
}

/**
 * One unconditional line at startup, same shape as the effective-timeout and
 * [AutoSync] EFFECTIVE STATE lines. Unconditional is the whole point: a marker that only appears
 * under some condition cannot be used to prove a build is present.
 */
export function logBuildIdentity(): void {
  const b = getBuildInfo();
  console.log(
    `[Build] BUILD IDENTITY — commit=${b.commit}, branch=${b.branch}, source=${b.source}, startedAt=${b.startedAt}`
  );
  if (b.source === 'unknown') {
    console.warn(
      '[Build] ⚠️ Build identity UNRESOLVED — no git working tree and no BUILD_COMMIT/GIT_COMMIT env. ' +
      'This instance cannot be version-confirmed remotely; set BUILD_COMMIT at build time.'
    );
  }
}
