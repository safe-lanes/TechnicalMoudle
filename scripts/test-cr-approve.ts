/**
 * Test Change Request Approve flow with both legacy ID and UUID target_id
 * Tests the exact scenario: create CR -> submit -> approve (which applies changes)
 */

const BASE = 'http://localhost:5002/technical/api';
const VESSEL_ID = '743ef9d1-841a-11ed-aa7c-7003bca91a86';

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    console.error(`  FAILED ${res.status}:`, JSON.stringify(json).substring(0, 200));
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).substring(0, 100)}`);
  }
  return json;
}

async function testComponentCR(useUuid: boolean) {
  const label = useUuid ? 'UUID' : 'Legacy ID';
  console.log(`\n=== Test: Component CR with ${label} as target_id ===`);

  // 1. Get a component
  const components = await fetchJson(`${BASE}/components?vesselId=${VESSEL_ID}`);
  const comp = components[0];
  console.log(`  Component: ${comp.name} (id: ${comp.id}, cuuid: ${comp.cuuid})`);

  const targetId = useUuid ? comp.cuuid : comp.id;
  const originalName = comp.name;
  const newName = `${originalName} - TEST-CR-${Date.now()}`;

  // 2. Create a change request with target_id
  console.log(`  Creating CR with targetId: ${targetId}`);
  const cr = await fetchJson(`${BASE}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      category: 'component',
      title: `Test CR for component (${label})`,
      reason: 'Testing change request approval with target_id',
      targetType: 'component',
      targetId: targetId,
      status: 'submitted',
      requestedByUserId: 'test-user',

      snapshotBeforeJson: { name: originalName },
      proposedChangesJson: [
        { field: 'name', oldValue: originalName, newValue: newName, justification: 'test' }
      ],
    }),
  });
  console.log(`  Created CR id: ${cr.id}, status: ${cr.status}, targetId: ${cr.targetId}`);

  // 3. Approve the change request (this should apply changes to the component)
  console.log(`  Approving CR ${cr.id}...`);
  try {
    const approved = await fetchJson(`${BASE}/change-requests/${cr.id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({
        comment: 'Approved for testing',
        reviewerId: 'test-reviewer',
      }),
    });
    console.log(`  Approved! status: ${approved.status}, revisionNumber: ${approved.revisionNumber}`);

    // 4. Verify the component was updated
    const updated = await fetchJson(`${BASE}/components/${comp.cuuid}?vesselId=${VESSEL_ID}`);
    if (updated.name === newName) {
      console.log(`  ✅ PASS: Component name updated to "${newName}"`);
    } else {
      console.log(`  ❌ FAIL: Component name is "${updated.name}", expected "${newName}"`);
    }

    // 5. Revert the change (clean up)
    await fetchJson(`${BASE}/components/${comp.cuuid}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: originalName }),
    });
    console.log(`  Reverted component name to "${originalName}"`);

    // 6. Clean up CR
    await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
    console.log(`  Deleted CR ${cr.id}`);

    return true;
  } catch (err: any) {
    console.log(`  ❌ FAIL: ${err.message}`);

    // Clean up CR on failure
    await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
    console.log(`  Deleted CR ${cr.id}`);

    return false;
  }
}

async function testJobCR(useUuid: boolean) {
  const label = useUuid ? 'UUID' : 'Legacy ID';
  console.log(`\n=== Test: Job CR with ${label} as target_id ===`);

  // 1. Get a job
  const jobs = await fetchJson(`${BASE}/jobs?vesselId=${VESSEL_ID}`);
  const job = jobs[0];
  console.log(`  Job: ${job.jobTitle || job.id} (id: ${job.id}, juuid: ${job.juuid})`);

  const targetId = useUuid ? job.juuid : job.id;
  const originalDesc = job.description || '';
  const newDesc = `Test-CR-${Date.now()}`;

  // 2. Create CR
  console.log(`  Creating CR with targetId: ${targetId}`);
  const cr = await fetchJson(`${BASE}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      category: 'job',
      title: `Test CR for job (${label})`,
      reason: 'Testing',
      targetType: 'job',
      targetId: targetId,
      status: 'submitted',
      requestedByUserId: 'test-user',

      snapshotBeforeJson: { description: originalDesc },
      proposedChangesJson: [
        { field: 'description', oldValue: originalDesc, newValue: newDesc, justification: 'test' }
      ],
    }),
  });
  console.log(`  Created CR id: ${cr.id}, targetId: ${cr.targetId}`);

  // 3. Approve
  console.log(`  Approving CR ${cr.id}...`);
  try {
    const approved = await fetchJson(`${BASE}/change-requests/${cr.id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Approved', reviewerId: 'test-reviewer' }),
    });
    console.log(`  Approved! status: ${approved.status}`);

    // 4. Verify
    const updated = await fetchJson(`${BASE}/jobs/${job.juuid}?vesselId=${VESSEL_ID}`);
    if (updated.description === newDesc) {
      console.log(`  ✅ PASS: Job description updated`);
    } else {
      console.log(`  ❌ FAIL: Job description is "${updated.description}", expected "${newDesc}"`);
    }

    // 5. Revert
    await fetchJson(`${BASE}/jobs/${job.juuid}`, {
      method: 'PATCH',
      body: JSON.stringify({ description: originalDesc }),
    });

    // 6. Clean up
    await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
    return true;
  } catch (err: any) {
    console.log(`  ❌ FAIL: ${err.message}`);
    await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
    return false;
  }
}

async function testSpareCR(useUuid: boolean) {
  const label = useUuid ? 'UUID' : 'Legacy integer ID';
  console.log(`\n=== Test: Spare CR with ${label} as target_id ===`);

  // 1. Get a spare
  const spares = await fetchJson(`${BASE}/spares/${VESSEL_ID}`);
  const spare = spares[0];
  console.log(`  Spare: ${spare.partName} (id: ${spare.id}, suuid: ${spare.suuid})`);

  const targetId = useUuid ? spare.suuid : String(spare.id);
  const originalPartName = spare.partName || '';
  const newPartName = `TestPart-${Date.now()}`;

  // 2. Create CR
  console.log(`  Creating CR with targetId: ${targetId}`);
  const cr = await fetchJson(`${BASE}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      category: 'spare',
      title: `Test CR for spare (${label})`,
      reason: 'Testing',
      targetType: 'spare',
      targetId: targetId,
      status: 'submitted',
      requestedByUserId: 'test-user',

      snapshotBeforeJson: { partName: originalPartName },
      proposedChangesJson: [
        { field: 'partName', oldValue: originalPartName, newValue: newPartName, justification: 'test' }
      ],
    }),
  });
  console.log(`  Created CR id: ${cr.id}, targetId: ${cr.targetId}`);

  // 3. Approve
  console.log(`  Approving CR ${cr.id}...`);
  try {
    const approved = await fetchJson(`${BASE}/change-requests/${cr.id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Approved', reviewerId: 'test-reviewer' }),
    });
    console.log(`  Approved! status: ${approved.status}`);

    // 4. Verify
    const updated = await fetchJson(`${BASE}/spares/${VESSEL_ID}/${spare.id}`);
    if (updated.partName === newPartName) {
      console.log(`  ✅ PASS: Spare partName updated`);
    } else {
      console.log(`  ❌ FAIL: Spare partName is "${updated.partName}", expected "${newPartName}"`);
    }

    // 5. Revert
    await fetchJson(`${BASE}/spares/${VESSEL_ID}/${spare.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ partName: originalPartName }),
    });

    // 6. Clean up
    await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
    return true;
  } catch (err: any) {
    console.log(`  ❌ FAIL: ${err.message}`);
    await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
    return false;
  }
}

async function main() {
  console.log('Change Request Approve API — Dual-Lookup Test');
  console.log('='.repeat(60));

  const results: { test: string; pass: boolean }[] = [];

  // Test components with both ID formats
  results.push({ test: 'Component CR (UUID)', pass: await testComponentCR(true) });
  results.push({ test: 'Component CR (Legacy ID)', pass: await testComponentCR(false) });

  // Test jobs with both ID formats
  results.push({ test: 'Job CR (UUID)', pass: await testJobCR(true) });
  results.push({ test: 'Job CR (Legacy ID)', pass: await testJobCR(false) });

  // Test spares with both ID formats
  results.push({ test: 'Spare CR (UUID)', pass: await testSpareCR(true) });
  results.push({ test: 'Spare CR (Legacy integer ID)', pass: await testSpareCR(false) });

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS:');
  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.test}`);
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n${passed}/${results.length} tests passed`);

  if (passed < results.length) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
