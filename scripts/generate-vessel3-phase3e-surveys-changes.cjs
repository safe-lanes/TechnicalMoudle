const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const VESSEL_NAME = 'Vessel 3';

const CREW = {
  chief_eng: '228b5256-5bd2-4bf3-826f-c6fe76571449',
  second_eng: '056a433e-b880-43c6-9d59-b1cfe71a4014',
  third_eng: '6084f3b8-85dc-462a-b045-111d2b2e6d0e',
};

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

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SURVEY_FINDINGS = [
  'No deficiencies found. All items satisfactory.',
  'Minor corrosion noted on hull plating, within acceptable limits.',
  'Safety equipment inspected and found in good working condition.',
  'Thickness measurement within class requirements.',
  'All certificates verified and found valid.',
  'Machinery running parameters within normal operating range.',
  'Fire detection system tested satisfactorily.',
  'Navigation equipment calibrated and operational.',
  'Ballast water management system functioning as per regulations.',
  'Emergency generator tested under load - satisfactory performance.',
  'Lifeboat davit wire inspected - no visible defects.',
  'Main engine performance within acceptable parameters.',
  'Auxiliary boiler safety valves tested - lifting at set pressure.',
  'Steering gear tested in all modes - satisfactory.',
  'Bilge pumping arrangements tested - all operational.',
];

const APPROVAL_REMARKS = [
  'Reviewed and approved. Changes align with manufacturer recommendations.',
  'Approved after technical review. Implementation to proceed as planned.',
  'Approved. Ensure updated documentation is distributed to all relevant personnel.',
  'Change approved per fleet management directive. Monitor performance after implementation.',
  'Approved. Maker service letter supports this modification.',
  'Reviewed by technical superintendent. Approved for implementation.',
  'Approved. Class society notified of the change.',
  'Change is in line with latest industry best practices. Approved.',
  'Approved after consultation with equipment manufacturer.',
  'Approved. Safety assessment completed with no concerns identified.',
];

const REJECTION_REASONS = [
  'Insufficient technical justification provided. Please resubmit with supporting documentation.',
  'Proposed change conflicts with class requirements. Consult with class surveyor first.',
  'Budget constraints - defer to next financial quarter.',
  'Alternative solution identified that better addresses the root cause.',
  'Manufacturer does not recommend this modification. Risk assessment required.',
  'Similar change was previously attempted and found unsatisfactory.',
  'Requires further evaluation by shore-based technical team.',
  'Not aligned with fleet-wide maintenance strategy. Discuss with fleet manager.',
];

const PENDING_REVIEW_REMARKS = [
  'Under review by technical superintendent.',
  'Awaiting class society confirmation.',
  'Additional documentation requested from vessel.',
  'Pending budget approval from management.',
  'Technical assessment in progress.',
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== Phase 3E: Survey Findings & Change Request Approval Workflows ===\n');

    // ============================================================
    // PART 1: Update vessel_survey_data
    // ============================================================
    console.log('--- PART 1: Survey Data Enhancement ---\n');

    const surveyResult = await pool.query(
      `SELECT vsd.*, ssm.survey_name, ssm.category
       FROM vessel_survey_data vsd
       JOIN ship_surveys_master ssm ON ssm.id = vsd.master_id::int
       WHERE vsd.vessel_id = $1
       ORDER BY vsd.id`,
      [VESSEL_ID]
    );
    const surveys = surveyResult.rows;
    console.log(`Found ${surveys.length} survey records for ${VESSEL_NAME}`);

    const today = new Date('2026-02-13');
    const totalSurveys = surveys.length;
    const completedCount = Math.round(totalSurveys * 0.60);
    const dueCount = Math.round(totalSurveys * 0.30);
    const overdueCount = totalSurveys - completedCount - dueCount;

    let surveyUpdated = 0;
    let statusCounts = { completed: 0, due: 0, overdue: 0 };

    for (let i = 0; i < surveys.length; i++) {
      const survey = surveys[i];
      let surveyDate = survey.survey_date;
      let dueDate = survey.due_date;
      let postponed = survey.postponed;

      if (i < completedCount) {
        const completedDate = addDays(today, -randomInt(30, 365));
        surveyDate = formatDateDMY(completedDate);
        dueDate = formatDateDMY(addMonths(completedDate, 12));
        postponed = 'No';
        statusCounts.completed++;
      } else if (i < completedCount + dueCount) {
        const lastDate = addDays(today, -randomInt(300, 700));
        surveyDate = formatDateDMY(lastDate);
        dueDate = formatDateDMY(addDays(today, randomInt(1, 90)));
        postponed = 'No';
        statusCounts.due++;
      } else {
        const lastDate = addDays(today, -randomInt(400, 800));
        surveyDate = formatDateDMY(lastDate);
        dueDate = formatDateDMY(addDays(today, -randomInt(1, 60)));
        postponed = Math.random() < 0.5 ? 'Yes' : 'No';
        statusCounts.overdue++;
      }

      await pool.query(
        `UPDATE vessel_survey_data
         SET survey_date = $1, due_date = $2, postponed = $3, updated_at = NOW()
         WHERE id = $4`,
        [surveyDate, dueDate, postponed, survey.id]
      );
      surveyUpdated++;
    }

    console.log(`Updated ${surveyUpdated} survey records:`);
    console.log(`  Completed: ${statusCounts.completed} (${Math.round(statusCounts.completed/totalSurveys*100)}%)`);
    console.log(`  Due:       ${statusCounts.due} (${Math.round(statusCounts.due/totalSurveys*100)}%)`);
    console.log(`  Overdue:   ${statusCounts.overdue} (${Math.round(statusCounts.overdue/totalSurveys*100)}%)`);

    // ============================================================
    // PART 2: Change Request Approval Workflows
    // ============================================================
    console.log('\n--- PART 2: Change Request Approval Workflows ---\n');

    const crResult = await pool.query(
      `SELECT * FROM change_request WHERE vessel_id = $1 ORDER BY id`,
      [VESSEL_ID]
    );
    const changeRequests = crResult.rows;
    console.log(`Found ${changeRequests.length} change requests for ${VESSEL_NAME}`);

    const statusBefore = {};
    changeRequests.forEach(cr => {
      statusBefore[cr.status] = (statusBefore[cr.status] || 0) + 1;
    });
    console.log('Status distribution BEFORE:', JSON.stringify(statusBefore));

    const totalCR = changeRequests.length;
    const approvedCount = Math.round(totalCR * 0.60);
    const pendingReviewCount = Math.round(totalCR * 0.20);
    const implementedCount = Math.round(totalCR * 0.10);
    const rejectedCount = totalCR - approvedCount - pendingReviewCount - implementedCount;

    const shuffled = [...changeRequests].sort(() => Math.random() - 0.5);

    let crUpdated = 0;
    let crStatusCounts = { Approved: 0, 'Pending Review': 0, Implemented: 0, Rejected: 0 };
    let commentsAdded = 0;

    for (let i = 0; i < shuffled.length; i++) {
      const cr = shuffled[i];
      let newStatus, reviewedBy, reviewedAt, revisionHistory;

      const submitDate = cr.submitted_at ? new Date(cr.submitted_at) : new Date(cr.created_at);

      if (i < approvedCount) {
        newStatus = 'Approved';
        reviewedBy = CREW.chief_eng;
        reviewedAt = addDays(submitDate, randomInt(2, 7));
        crStatusCounts.Approved++;

        const remark = pickRandom(APPROVAL_REMARKS);
        await pool.query(
          `INSERT INTO change_request_comment (change_request_id, user_id, message, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [cr.id, reviewedBy, remark, reviewedAt]
        );
        commentsAdded++;

      } else if (i < approvedCount + pendingReviewCount) {
        newStatus = 'Pending';
        reviewedBy = null;
        reviewedAt = null;
        crStatusCounts['Pending Review']++;

        const remark = pickRandom(PENDING_REVIEW_REMARKS);
        await pool.query(
          `INSERT INTO change_request_comment (change_request_id, user_id, message, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [cr.id, CREW.second_eng, remark, addDays(submitDate, randomInt(1, 3))]
        );
        commentsAdded++;

      } else if (i < approvedCount + pendingReviewCount + implementedCount) {
        newStatus = 'Approved';
        reviewedBy = CREW.chief_eng;
        reviewedAt = addDays(submitDate, randomInt(2, 5));
        crStatusCounts.Implemented++;

        const approvalRemark = pickRandom(APPROVAL_REMARKS);
        await pool.query(
          `INSERT INTO change_request_comment (change_request_id, user_id, message, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [cr.id, reviewedBy, approvalRemark, reviewedAt]
        );
        commentsAdded++;

        const implementRemark = 'Change implemented and verified. Closing request.';
        await pool.query(
          `INSERT INTO change_request_comment (change_request_id, user_id, message, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [cr.id, CREW.second_eng, implementRemark, addDays(reviewedAt, randomInt(3, 14))]
        );
        commentsAdded++;

      } else {
        newStatus = 'Rejected';
        reviewedBy = CREW.chief_eng;
        reviewedAt = addDays(submitDate, randomInt(2, 7));
        crStatusCounts.Rejected++;

        const rejectionReason = pickRandom(REJECTION_REASONS);
        await pool.query(
          `INSERT INTO change_request_comment (change_request_id, user_id, message, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [cr.id, reviewedBy, rejectionReason, reviewedAt]
        );
        commentsAdded++;
      }

      revisionHistory = cr.revision_history || [];
      if (!Array.isArray(revisionHistory)) {
        try { revisionHistory = JSON.parse(revisionHistory); } catch { revisionHistory = []; }
      }

      await pool.query(
        `UPDATE change_request
         SET status = $1, reviewed_by_user_id = $2, reviewed_at = $3,
             revision_history = $4, updated_at = NOW()
         WHERE id = $5`,
        [newStatus, reviewedBy, reviewedAt, JSON.stringify(revisionHistory), cr.id]
      );
      crUpdated++;
    }

    console.log(`\nUpdated ${crUpdated} change requests:`);
    console.log(`  Approved:       ${crStatusCounts.Approved} (${Math.round(crStatusCounts.Approved/totalCR*100)}%)`);
    console.log(`  Pending Review: ${crStatusCounts['Pending Review']} (${Math.round(crStatusCounts['Pending Review']/totalCR*100)}%)`);
    console.log(`  Implemented:    ${crStatusCounts.Implemented} (${Math.round(crStatusCounts.Implemented/totalCR*100)}%)`);
    console.log(`  Rejected:       ${crStatusCounts.Rejected} (${Math.round(crStatusCounts.Rejected/totalCR*100)}%)`);
    console.log(`  Comments added: ${commentsAdded}`);

    // Final verification
    const finalStatus = await pool.query(
      `SELECT status, COUNT(*) FROM change_request WHERE vessel_id = $1 GROUP BY status ORDER BY status`,
      [VESSEL_ID]
    );
    console.log('\nFinal change request status distribution:');
    finalStatus.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));

    const commentCount = await pool.query(
      `SELECT COUNT(*) FROM change_request_comment crc
       JOIN change_request cr ON cr.id = crc.change_request_id
       WHERE cr.vessel_id = $1`,
      [VESSEL_ID]
    );
    console.log(`Total comments for vessel: ${commentCount.rows[0].count}`);

    console.log('\n=== Phase 3E Complete ===');
    console.log(`Summary:`);
    console.log(`  Survey records updated: ${surveyUpdated}`);
    console.log(`  Change requests updated: ${crUpdated}`);
    console.log(`  Review comments added: ${commentsAdded}`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main();
