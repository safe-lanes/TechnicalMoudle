/**
 * SES approval-email transport — mocked-SDK tests (04-Sep-2026).
 * Covers the build brief's five cases: success, retryable failure with backoff, throttle
 * path (extra backoff), permanent error not retried, unconfigured → null config (the
 * notifier's 'skipped' branch; in-app delivery is independent of this module entirely).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMock = vi.fn();
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class { constructor(_cfg: unknown) { /* mocked */ } send = sendMock; },
  SendEmailCommand: class { input: unknown; constructor(input: unknown) { this.input = input; } },
}));

import {
  sesEmailConfig, sendApprovalEmail, PermanentEmailError,
  __setWaitForTests, __resetSesClientForTests,
} from '../sesEmailTransport';

const ENV_KEYS = ['APPROVAL_SMTP_JSON', 'APPROVAL_SES_REGION', 'AWS_SES_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'APPROVAL_EMAIL_FROM', 'SUPPORT_EMAIL'];
const saved: Record<string, string | undefined> = {};
let waits: number[] = [];

beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  sendMock.mockReset();
  __resetSesClientForTests();
  waits = [];
  __setWaitForTests(async (ms) => { waits.push(ms); }); // instant, recorded
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

function configure() {
  process.env.AWS_SES_REGION = 'ap-southeast-1';
  process.env.AWS_ACCESS_KEY_ID = 'test-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
  process.env.APPROVAL_EMAIL_FROM = 'approvals@test.local';
}
const err = (name: string, status?: number) => Object.assign(new Error(name), { name, $metadata: status ? { httpStatusCode: status } : undefined });

describe('sesEmailConfig (unconfigured behaviour)', () => {
  it('returns null with no env at all — the notifier then records skipped, in-app unaffected', () => {
    expect(sesEmailConfig()).toBeNull();
  });
  it('returns null when ANY required var is missing (no hardcoded fallback)', () => {
    configure(); delete process.env.AWS_SECRET_ACCESS_KEY;
    expect(sesEmailConfig()).toBeNull();
    configure(); delete process.env.APPROVAL_EMAIL_FROM; delete process.env.SUPPORT_EMAIL;
    expect(sesEmailConfig()).toBeNull();
  });
  it('SUPPORT_EMAIL is an accepted from-fallback; APPROVAL_EMAIL_FROM wins', () => {
    configure(); delete process.env.APPROVAL_EMAIL_FROM; process.env.SUPPORT_EMAIL = 'support@x.y';
    expect(sesEmailConfig()).toMatchObject({ from: 'support@x.y', mode: 'live' });
    process.env.APPROVAL_EMAIL_FROM = 'approvals@x.y';
    expect(sesEmailConfig()).toMatchObject({ from: 'approvals@x.y' });
  });
  it('APPROVAL_SMTP_JSON=1 = test mode without AWS', async () => {
    process.env.APPROVAL_SMTP_JSON = '1';
    const cfg = sesEmailConfig()!;
    expect(cfg.mode).toBe('json-test');
    expect(await sendApprovalEmail(cfg, 'a@b.c', 's', 't')).toBe('json-test');
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('sendApprovalEmail', () => {
  it('success: one SES call, correct payload', async () => {
    configure();
    sendMock.mockResolvedValueOnce({ MessageId: 'msg-1' });
    const id = await sendApprovalEmail(sesEmailConfig()!, 'to@x.y', 'Subject!', 'Body text');
    expect(id).toBe('msg-1');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const input = sendMock.mock.calls[0][0].input;
    expect(input.FromEmailAddress).toBe('approvals@test.local');
    expect(input.Destination.ToAddresses).toEqual(['to@x.y']);
    expect(input.Content.Simple.Subject.Data).toBe('Subject!');
  });

  it('retryable failure: exponential backoff with jitter, then success', async () => {
    configure();
    sendMock.mockRejectedValueOnce(err('InternalFailure')).mockRejectedValueOnce(err('InternalFailure')).mockResolvedValueOnce({ MessageId: 'msg-2' });
    const id = await sendApprovalEmail(sesEmailConfig()!, 'to@x.y', 's', 't');
    expect(id).toBe('msg-2');
    expect(sendMock).toHaveBeenCalledTimes(3);
    const backoffs = waits.filter((w) => w >= 400); // ignore pacing waits
    expect(backoffs.length).toBe(2);
    expect(backoffs[0]).toBeGreaterThanOrEqual(400); expect(backoffs[0]).toBeLessThan(400 + 251);   // base + jitter
    expect(backoffs[1]).toBeGreaterThanOrEqual(800); expect(backoffs[1]).toBeLessThan(800 + 251);   // doubled + jitter
  });

  it('throttling: extra backoff on top of the exponential step', async () => {
    configure();
    sendMock.mockRejectedValueOnce(err('ThrottlingException', 429)).mockResolvedValueOnce({ MessageId: 'msg-3' });
    await sendApprovalEmail(sesEmailConfig()!, 'to@x.y', 's', 't');
    const backoffs = waits.filter((w) => w >= 400);
    expect(backoffs.length).toBe(1);
    expect(backoffs[0]).toBeGreaterThanOrEqual(400 + 1000); // base + throttle extra
  });

  it('permanent errors are NOT retried', async () => {
    configure();
    for (const name of ['MessageRejected', 'MailFromDomainNotVerifiedException', 'AccountSuspendedException', 'SendingPausedException']) {
      sendMock.mockReset(); sendMock.mockRejectedValueOnce(err(name));
      await expect(sendApprovalEmail(sesEmailConfig()!, 'to@x.y', 's', 't')).rejects.toBeInstanceOf(PermanentEmailError);
      expect(sendMock).toHaveBeenCalledTimes(1); // exactly one attempt
    }
  });

  it('exhausted retries throw the last error (notifier records email_status=error)', async () => {
    configure();
    sendMock.mockRejectedValue(err('InternalFailure'));
    await expect(sendApprovalEmail(sesEmailConfig()!, 'to@x.y', 's', 't')).rejects.toThrow('InternalFailure');
    expect(sendMock).toHaveBeenCalledTimes(3);
  });
});
