/**
 * New-pair admin notification (§4.1: default-ON self-registration is only acceptable
 * with a notification on every new client×module pair).
 *
 * DECISION (Ghazi, 10-Sep-2026): notifications are DURABLE RECORDS ONLY — no email.
 * The admin console's pairs + notifications lists are the stated mitigation for the
 * default-ON registration risk; email delivery was judged not critical enough to
 * warrant a mail transport and its credentials. (A SigV4 SES sender existed briefly
 * in Stage 2 and was removed on that decision — see git history if ever wanted back.)
 */
import { pool } from './db.mjs';

const RECIPIENT = process.env.ASSISTANT_ADMIN_EMAIL || 'ghazi.anwer@safe-lanes.com';

export async function notifyNewPair(pair) {
  await pool.query(
    'INSERT INTO assistant_notifications (type, payload, delivered, delivery_detail) VALUES ($1,$2,$3,$4)',
    ['new_pair',
     JSON.stringify({ tenantDomain: pair.tenant_domain, module: pair.module, firstSeen: pair.first_seen, adminContact: RECIPIENT }),
     true, 'recorded for admin console (email deliberately not used — 10-Sep-2026 decision)'],
  );
  return { delivered: true, detail: 'recorded' };
}
