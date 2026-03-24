import nodemailer from 'nodemailer';
import type { NrNoonReport } from '@shared/schema';

// ── SMTP Configuration ───────────────────────────────────────────────────────
// Configure via environment variables:
//   NR_SMTP_HOST, NR_SMTP_PORT, NR_SMTP_USER, NR_SMTP_PASS, NR_SMTP_FROM
//   NR_EMAIL_TO_DEFAULT — fallback recipient if not provided in request

function createTransport() {
  const host = process.env.NR_SMTP_HOST;
  const port = parseInt(process.env.NR_SMTP_PORT || '587');
  const user = process.env.NR_SMTP_USER;
  const pass = process.env.NR_SMTP_PASS;

  if (!host || !user || !pass) {
    return null; // SMTP not configured
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

// ── Build plain-text report body ──────────────────────────────────────────────
function buildReportText(report: NrNoonReport, vesselName: string): string {
  const fmt = (v: any, decimals = 2) => {
    const n = Number(v);
    return isNaN(n) ? '—' : n.toFixed(decimals);
  };
  const str = (v: any) => v ?? '—';

  return `
NOON REPORT — ${report.reportDate} ${report.reportTime ?? ''} UTC
Vessel: ${vesselName}
Voyage: ${str(report.voyageNo)}
Route: ${str(report.portFrom)} → ${str(report.portTo)}
Condition: ${str(report.condition)}
Status: ${report.status.toUpperCase()}

── NAVIGATION ──────────────────────────────────
Speed:              ${fmt(report.speed, 1)} knots
Distance Sailed:    ${fmt(report.distanceSailed, 0)} NM
Course:             ${fmt(report.course, 0)}°
Next Port:          ${str(report.nextPort)}
Distance to Go:     ${fmt(report.distanceToGo, 0)} NM

── WEATHER ─────────────────────────────────────
Wind Direction:     ${str(report.windDirection)}
Wind Force:         ${str(report.windForce)} Beaufort
Sea State:          ${str(report.seaState)} Douglas
Visibility:         ${str(report.visibility)}
Air Temperature:    ${fmt(report.airTemperature, 1)} °C
Sea Temperature:    ${fmt(report.seaTemperature, 1)} °C

── FUEL CONSUMPTION (MT) ──────────────────────
HFO:    ${fmt(report.hfoConsumption, 3)}
LSMGO:  ${fmt(report.lsmgoConsumption, 3)}
MGO:    ${fmt(report.mgoConsumption, 3)}
VLSFO:  ${fmt(report.vlsfoConsumption, 3)}
LPG:    ${fmt(report.lpgConsumption, 3)}

── ROB AT NOON (MT) ────────────────────────────
HFO:    ${fmt(report.hfoRob, 3)}
LSMGO:  ${fmt(report.lsmgoRob, 3)}
MGO:    ${fmt(report.mgoRob, 3)}
VLSFO:  ${fmt(report.vlsfoRob, 3)}
LPG:    ${fmt(report.lpgRob, 3)}

── MACHINERY ───────────────────────────────────
ME Load:            ${fmt(report.meLoad, 1)} % MCR
ME RPM:             ${fmt(report.meRpm, 0)}
ME Running Hours:   ${fmt(report.meHours, 1)} h

── EMISSIONS ───────────────────────────────────
CO₂ Total:          ${fmt(report.co2Total, 2)} t
EEOI:               ${fmt(report.eeoi, 4)}
CII Rating:         ${str(report.ciiRating)}

── CARGO / REMARKS ─────────────────────────────
Draft Forward:      ${fmt(report.draftForward, 2)} m
Draft Aft:          ${fmt(report.draftAft, 2)} m
Cargo:              ${str(report.cargoQuantity)} MT — ${str(report.cargoDescription)}
Remarks:            ${str(report.generalRemarks)}

Submitted by: ${str(report.submittedBy)}
Submitted at: ${report.submittedAt ? new Date(report.submittedAt).toISOString() : '—'}
`.trim();
}

// ── Build simple HTML version ─────────────────────────────────────────────────
function buildReportHtml(report: NrNoonReport, vesselName: string): string {
  const text = buildReportText(report, vesselName);
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; background: #f9f9f9; margin: 0; padding: 20px; }
  .container { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 24px; max-width: 680px; margin: 0 auto; }
  h2 { color: #1e3a5f; margin-top: 0; }
  pre { font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; line-height: 1.6; }
  .footer { font-size: 11px; color: #999; margin-top: 16px; border-top: 1px solid #eee; padding-top: 8px; }
</style>
</head><body>
<div class="container">
  <h2>Noon Report — ${report.reportDate}</h2>
  <pre>${escaped}</pre>
  <div class="footer">Sent from Sail Maritime Technical Management System</div>
</div>
</body></html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SendReportEmailOptions {
  report: NrNoonReport;
  vesselName: string;
  to: string; // comma-separated list allowed
  cc?: string;
}

export interface EmailResult {
  success: boolean;
  message: string;
  previewUrl?: string;
}

export async function sendReportEmail(opts: SendReportEmailOptions): Promise<EmailResult> {
  const transport = createTransport();

  if (!transport) {
    return {
      success: false,
      message: 'SMTP is not configured. Set NR_SMTP_HOST, NR_SMTP_USER, and NR_SMTP_PASS environment variables.',
    };
  }

  const from = process.env.NR_SMTP_FROM || process.env.NR_SMTP_USER || 'noreply@example.com';
  const subject = `Noon Report — ${opts.report.reportDate} | ${opts.vesselName} | Voyage ${opts.report.voyageNo ?? 'N/A'}`;

  try {
    const info = await transport.sendMail({
      from,
      to: opts.to,
      cc: opts.cc,
      subject,
      text: buildReportText(opts.report, opts.vesselName),
      html: buildReportHtml(opts.report, opts.vesselName),
    });

    return {
      success: true,
      message: `Email sent to ${opts.to}`,
      previewUrl: nodemailer.getTestMessageUrl(info) || undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message ?? 'Failed to send email',
    };
  }
}

export function isSmtpConfigured(): boolean {
  return !!(
    process.env.NR_SMTP_HOST &&
    process.env.NR_SMTP_USER &&
    process.env.NR_SMTP_PASS
  );
}
