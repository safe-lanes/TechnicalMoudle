const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const VESSEL_NAME = 'Vessel 3';

function formatDateDMY(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== Phase 3D: Certificate Renewal Lifecycle Enhancement ===\n');

    const existing = await pool.query(
      `SELECT vcd.*, scm.certificate_name, scm.category, scm."group"
       FROM vessel_certificate_data vcd
       JOIN ship_certificates_master scm ON scm.id = vcd.master_id::int
       WHERE vcd.vessel_id = $1
       ORDER BY vcd.id`,
      [VESSEL_ID]
    );
    console.log(`Found ${existing.rows.length} existing certificates for Vessel 3`);

    const today = new Date('2026-02-13');
    const totalCerts = existing.rows.length;

    const activeCount = Math.round(totalCerts * 0.70);
    const dueCount = Math.round(totalCerts * 0.15);
    const renewedCount = Math.round(totalCerts * 0.10);
    const expiredCount = totalCerts - activeCount - dueCount - renewedCount;

    console.log(`\nTarget distribution:`);
    console.log(`  Active/Valid: ${activeCount} (70%)`);
    console.log(`  Due for Renewal: ${dueCount} (15%)`);
    console.log(`  Recently Renewed: ${renewedCount} (10%)`);
    console.log(`  Expired: ${expiredCount} (5%)\n`);

    const indices = existing.rows.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const statusAssignment = {};
    let idx = 0;
    for (let i = 0; i < activeCount && idx < indices.length; i++, idx++) {
      statusAssignment[indices[idx]] = 'Active';
    }
    for (let i = 0; i < dueCount && idx < indices.length; i++, idx++) {
      statusAssignment[indices[idx]] = 'Due for Renewal';
    }
    for (let i = 0; i < renewedCount && idx < indices.length; i++, idx++) {
      statusAssignment[indices[idx]] = 'Recently Renewed';
    }
    for (let i = 0; i < expiredCount && idx < indices.length; i++, idx++) {
      statusAssignment[indices[idx]] = 'Expired';
    }

    let updatedCount = 0;
    let renewalRecordsAdded = 0;
    const summary = { Active: 0, 'Due for Renewal': 0, 'Recently Renewed': 0, Expired: 0 };

    for (let i = 0; i < existing.rows.length; i++) {
      const cert = existing.rows[i];
      const status = statusAssignment[i] || 'Active';
      summary[status]++;

      let issueDate, expiryDate, lastAnnual, lastInterm, endorsementDate;

      switch (status) {
        case 'Active': {
          issueDate = addDays(new Date('2023-06-01'), randomInt(0, 180));
          expiryDate = new Date(issueDate);
          expiryDate.setFullYear(expiryDate.getFullYear() + 5);
          lastAnnual = addDays(new Date('2025-06-01'), randomInt(0, 120));
          lastInterm = addDays(new Date('2024-08-01'), randomInt(0, 90));
          endorsementDate = addDays(lastAnnual, randomInt(1, 14));
          break;
        }
        case 'Due for Renewal': {
          issueDate = addDays(new Date('2021-01-01'), randomInt(0, 120));
          expiryDate = addDays(today, randomInt(7, 85));
          lastAnnual = addDays(new Date('2025-01-01'), randomInt(0, 60));
          lastInterm = addDays(new Date('2024-03-01'), randomInt(0, 90));
          endorsementDate = addDays(lastAnnual, randomInt(1, 7));
          break;
        }
        case 'Recently Renewed': {
          const renewalDate = addDays(today, -randomInt(7, 60));
          issueDate = renewalDate;
          expiryDate = new Date(renewalDate);
          expiryDate.setFullYear(expiryDate.getFullYear() + 5);
          lastAnnual = renewalDate;
          lastInterm = addDays(new Date('2024-06-01'), randomInt(0, 90));
          endorsementDate = addDays(renewalDate, randomInt(1, 5));
          break;
        }
        case 'Expired': {
          issueDate = addDays(new Date('2020-06-01'), randomInt(0, 180));
          expiryDate = addDays(today, -randomInt(10, 120));
          lastAnnual = addDays(new Date('2024-10-01'), randomInt(0, 60));
          lastInterm = addDays(new Date('2023-09-01'), randomInt(0, 90));
          endorsementDate = null;
          break;
        }
      }

      const lastEditUpload = formatDateDMY(addDays(lastAnnual, randomInt(0, 30)));

      await pool.query(
        `UPDATE vessel_certificate_data
         SET issue_date = $1, expiry_date = $2, last_annual = $3, last_interm = $4,
             endorsement_date = $5, last_edit_upload = $6, updated_at = NOW()
         WHERE id = $7`,
        [
          formatDateDMY(issueDate),
          formatDateDMY(expiryDate),
          formatDateDMY(lastAnnual),
          formatDateDMY(lastInterm),
          endorsementDate ? formatDateDMY(endorsementDate) : null,
          lastEditUpload,
          cert.id
        ]
      );
      updatedCount++;
      console.log(`  [${status}] ${cert.certificate_name} (ID:${cert.id}) - Expiry: ${formatDateDMY(expiryDate)}`);

      const annualCerts = ['Safety Equipment Certificate', 'Safety Construction Certificate',
        'Safety Radio Certificate', 'IOPP Certificate', 'SMC Certificate',
        'MLC Certificate', 'ISSC Certificate', 'Class Certificate',
        'Cargo Ship Safety Certificate', 'P&I Certificate'];

      if (annualCerts.includes(cert.certificate_name)) {
        const baseIssue = new Date(issueDate);
        for (let year = 1; year <= 2; year++) {
          const renewIssue = new Date(baseIssue);
          renewIssue.setFullYear(renewIssue.getFullYear() + year);
          if (renewIssue > today) break;

          const renewExpiry = new Date(renewIssue);
          renewExpiry.setFullYear(renewExpiry.getFullYear() + 1);

          const renewAnnual = addDays(renewIssue, randomInt(330, 365));
          const renewInterm = addDays(renewIssue, randomInt(150, 200));

          const renewEndorsement = addDays(renewAnnual, randomInt(1, 10));

          try {
            await pool.query(
              `INSERT INTO vessel_certificate_data (
                vessel_id, vessel_name, master_id, issue_date, expiry_date,
                last_annual, last_interm, endorsement_date, last_edit_upload,
                attachments, created_at, updated_at
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
              [
                VESSEL_ID, VESSEL_NAME, cert.master_id,
                formatDateDMY(renewIssue),
                formatDateDMY(renewExpiry),
                formatDateDMY(renewAnnual > today ? addDays(today, -randomInt(10, 60)) : renewAnnual),
                formatDateDMY(renewInterm),
                renewEndorsement <= today ? formatDateDMY(renewEndorsement) : null,
                formatDateDMY(addDays(renewInterm, randomInt(5, 20))),
                '[]'
              ]
            );
            renewalRecordsAdded++;
          } catch (err) {
            console.error(`    Renewal insert error for ${cert.certificate_name} year ${year}: ${err.message}`);
          }
        }
      }
    }

    const finalCount = await pool.query(
      `SELECT COUNT(*) as total FROM vessel_certificate_data WHERE vessel_id = $1`,
      [VESSEL_ID]
    );

    console.log(`\n=== PHASE 3D COMPLETE ===`);
    console.log(`Existing certificates updated: ${updatedCount}`);
    console.log(`Renewal cycle records added: ${renewalRecordsAdded}`);
    console.log(`Total certificate records now: ${finalCount.rows[0].total}`);
    console.log(`\nStatus Distribution:`);
    console.log(`  Active/Valid:      ${summary['Active']} (${((summary['Active']/totalCerts)*100).toFixed(0)}%)`);
    console.log(`  Due for Renewal:   ${summary['Due for Renewal']} (${((summary['Due for Renewal']/totalCerts)*100).toFixed(0)}%)`);
    console.log(`  Recently Renewed:  ${summary['Recently Renewed']} (${((summary['Recently Renewed']/totalCerts)*100).toFixed(0)}%)`);
    console.log(`  Expired:           ${summary['Expired']} (${((summary['Expired']/totalCerts)*100).toFixed(0)}%)`);

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
