/**
 * Approval email transport — AWS SES (SESv2), 04-Sep-2026.
 *
 * Replaces the never-configured SMTP path (the notifier previously rode the noon-report
 * nodemailer envs). Follows the Audit module's proven SES patterns, sized to what
 * approval notifications actually need:
 *   - sequential sends, paced ≥100ms apart (well under the SES 14/sec default),
 *   - retry with exponential backoff + jitter; throttling gets extra backoff,
 *   - permanent SES errors (MessageRejected, MailFromDomainNotVerified,
 *     AccountSuspended, SendingPaused) are NOT retried,
 *   - NO raw MIME, attachments, bulk API or deferred retry queue — approval emails are
 *     short per-user texts; a final failure is recorded on the notification row
 *     (email_status='error') which is the module's existing status surface. Say-so per
 *     the build brief: nothing here needs more.
 *
 * CONFIG BY ENV ONLY (names, no values — ops sets these per environment):
 *   AWS_SES_REGION (or APPROVAL_SES_REGION to override just approvals)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 *   APPROVAL_EMAIL_FROM (or SUPPORT_EMAIL) — the verified SES sender
 * Any of them absent → 'unconfigured': callers skip email, in-app delivery unaffected.
 * APPROVAL_SMTP_JSON=1 keeps the pilot/test mode: the send path runs and logs the
 * payload as JSON without touching AWS (same env the notify harness already uses).
 *
 * A send failure NEVER propagates past the notifier's per-user try/catch — email can
 * never break or block an approval.
 */
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

export interface SesEmailConfig {
  region: string;
  from: string;
  mode: 'live' | 'json-test';
}

/** SES error names that will never succeed on retry (Audit module's list). */
const PERMANENT_ERRORS = new Set([
  'MessageRejected',
  'MailFromDomainNotVerifiedException',
  'AccountSuspendedException',
  'SendingPausedException',
]);
const THROTTLE_ERRORS = new Set(['ThrottlingException', 'TooManyRequestsException', 'Throttling']);

const SEND_INTERVAL_MS = 100;   // pacing between sequential sends
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;    // 400 → 800 (+ jitter); throttle adds THROTTLE_EXTRA_MS
const THROTTLE_EXTRA_MS = 1000;
const JITTER_MS = 250;

/** Test seam: vitest replaces the waiter so backoff tests run instantly. */
let wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export function __setWaitForTests(fn: (ms: number) => Promise<void>): void { wait = fn; }

export function sesEmailConfig(): SesEmailConfig | null {
  const from = process.env.APPROVAL_EMAIL_FROM || process.env.SUPPORT_EMAIL;
  if (process.env.APPROVAL_SMTP_JSON === '1') {
    return { region: 'json-test', from: from || 'approvals@test.local', mode: 'json-test' };
  }
  const region = process.env.APPROVAL_SES_REGION || process.env.AWS_SES_REGION;
  const keyId = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !keyId || !secret || !from) return null; // unconfigured — never a hardcoded fallback
  return { region, from, mode: 'live' };
}

let client: SESv2Client | null = null;
let clientRegion: string | null = null;
function sesClient(region: string): SESv2Client {
  if (!client || clientRegion !== region) {
    // Credentials come from the SDK's standard env chain (AWS_ACCESS_KEY_ID/SECRET) —
    // sesEmailConfig() has already required them, so nothing implicit sneaks in.
    client = new SESv2Client({ region });
    clientRegion = region;
  }
  return client;
}
/** Test seam: reset the cached client between vitest cases. */
export function __resetSesClientForTests(): void { client = null; clientRegion = null; }

let lastSendAt = 0;

export class PermanentEmailError extends Error {
  constructor(name: string, message: string) { super(`${name}: ${message}`); this.name = 'PermanentEmailError'; }
}

/**
 * Send one approval email. Throws on final failure (PermanentEmailError for the
 * non-retryable class) — the notifier catches per-recipient and records
 * email_status='error'. Returns the SES message id ('json-test' in test mode).
 */
export async function sendApprovalEmail(cfg: SesEmailConfig, to: string, subject: string, text: string): Promise<string> {
  if (cfg.mode === 'json-test') {
    console.log(`[approvals] EMAIL (json-test) ${JSON.stringify({ from: cfg.from, to, subject, text: text.slice(0, 200) })}`);
    return 'json-test';
  }

  // Pacing: keep sequential sends ≥ SEND_INTERVAL_MS apart.
  const gap = lastSendAt + SEND_INTERVAL_MS - Date.now();
  if (gap > 0) await wait(gap);

  let lastErr: any = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      lastSendAt = Date.now();
      const out = await sesClient(cfg.region).send(new SendEmailCommand({
        FromEmailAddress: cfg.from,
        Destination: { ToAddresses: [to] },
        Content: { Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Text: { Data: text, Charset: 'UTF-8' } },
        } },
      }));
      return out.MessageId ?? 'sent';
    } catch (e: any) {
      const name = String(e?.name ?? e?.Code ?? 'Error');
      if (PERMANENT_ERRORS.has(name)) {
        throw new PermanentEmailError(name, String(e?.message ?? e)); // never retried
      }
      lastErr = e;
      if (attempt === MAX_ATTEMPTS) break;
      const throttled = THROTTLE_ERRORS.has(name) || e?.$metadata?.httpStatusCode === 429;
      const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1)
        + (throttled ? THROTTLE_EXTRA_MS : 0)
        + Math.floor(Math.random() * JITTER_MS);
      console.warn(`[approvals] SES send to ${to} failed (attempt ${attempt}/${MAX_ATTEMPTS}, ${name}${throttled ? ', throttled' : ''}) — retrying in ${backoff}ms`);
      await wait(backoff);
    }
  }
  throw lastErr;
}
