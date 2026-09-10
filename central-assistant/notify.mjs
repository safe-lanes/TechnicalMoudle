/**
 * New-pair admin notification (§4.1: default-ON self-registration is only acceptable
 * with a notification on every new client×module pair).
 *
 * Every notification is DURABLY RECORDED in assistant_notifications first; email
 * delivery is best-effort on top. Transport: AWS SESv2 via SigV4 (no SDK) when
 * AWS_SES_REGION + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + ASSISTANT_EMAIL_FROM
 * are configured; otherwise the notification is stored with delivered=false and a
 * clear detail, so nothing is silently lost while transport is unconfigured.
 */
import { createHmac, createHash } from 'node:crypto';
import { pool } from './db.mjs';

const RECIPIENT = process.env.ASSISTANT_ADMIN_EMAIL || 'ghazi.anwer@safe-lanes.com';

function hmac(key, data) { return createHmac('sha256', key).update(data).digest(); }
function sha256hex(data) { return createHash('sha256').update(data).digest('hex'); }

async function sendSesEmail(subject, textBody) {
  const region = process.env.AWS_SES_REGION;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const from = process.env.ASSISTANT_EMAIL_FROM;
  if (!region || !accessKey || !secretKey || !from) {
    return { delivered: false, detail: 'email transport not configured (recorded only)' };
  }
  const host = `email.${region}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const body = JSON.stringify({
    FromEmailAddress: from,
    Destination: { ToAddresses: [RECIPIENT] },
    Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: textBody } } } },
  });
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/ses/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256hex(canonicalRequest)}`;
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), 'ses'), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const r = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Amz-Date': amzDate, Authorization: auth },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  return r.ok
    ? { delivered: true, detail: `SES accepted: ${text.slice(0, 120)}` }
    : { delivered: false, detail: `SES HTTP ${r.status}: ${text.slice(0, 200)}` };
}

export async function notifyNewPair(pair) {
  const subject = `[SAIL Assistant] New client×module registered: ${pair.tenant_domain} × ${pair.module}`;
  const text =
    `A new client×module pair self-registered on first use (enabled by default):\n\n` +
    `  Client/domain : ${pair.tenant_domain}\n` +
    `  Module        : ${pair.module}\n` +
    `  First seen    : ${pair.first_seen}\n\n` +
    `Disable it from the assistant admin (pairs matrix) if this is unexpected.`;
  let result;
  try {
    result = await sendSesEmail(subject, text);
  } catch (e) {
    result = { delivered: false, detail: `send failed: ${e?.message || e}` };
  }
  await pool.query(
    'INSERT INTO assistant_notifications (type, payload, delivered, delivery_detail) VALUES ($1,$2,$3,$4)',
    ['new_pair', JSON.stringify({ tenantDomain: pair.tenant_domain, module: pair.module, recipient: RECIPIENT }),
     result.delivered, result.detail],
  );
  return result;
}
