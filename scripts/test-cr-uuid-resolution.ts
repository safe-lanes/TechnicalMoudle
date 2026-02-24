/**
 * Test that change_request.target_id is ALWAYS resolved to UUID before storage.
 * Even when frontend sends a legacy ID, the backend should resolve it to UUID.
 */
import pg from 'pg';

const BASE = 'http://localhost:5002/technical/api';
const VESSEL_ID = '743ef9d1-841a-11ed-aa7c-7003bca91a86';
const DB_URL = 'postgres://postgres:admin123@localhost:5432/pms';

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    console.error(`  FAILED ${res.status}:`, JSON.stringify(json).substring(0, 300));
    throw new Error(`HTTP ${res.status}`);
  }
  return json;
}

// Direct DB check to confirm what's actually stored in target_id
async function getStoredTargetId(crId: number): Promise<string | null> {
  const pool = new pg.Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT target_id FROM change_request WHERE id = $1', [crId]);
    return res.rows[0]?.target_id || null;
  } finally {
    client.release();
    await pool.end();
  }
}

// Check if a string looks like a UUID
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function testComponentWithLegacyId() {
  console.log('\n=== Test 1: Component — send legacy ID, expect UUID stored ===');
  const components = await fetchJson(`${BASE}/components?vesselId=${VESSEL_ID}`);
  const comp = components[0];
  console.log(`  Component legacy ID: ${comp.id}`);
  console.log(`  Component cuuid:     ${comp.cuuid}`);

  // Create CR with LEGACY ID
  const cr = await fetchJson(`${BASE}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      category: 'component',
      title: 'UUID resolution test - component',
      reason: 'Testing UUID resolution',
      targetType: 'component',
      targetId: comp.id, // LEGACY ID like "COMP-xxx"
      status: 'draft',
      requestedByUserId: 'test-user',
      proposedChangesJson: [{ field: 'name', oldValue: comp.name, newValue: 'Test', justification: 'test' }],
    }),
  });

  const storedTargetId = await getStoredTargetId(cr.id);
  console.log(`  Sent targetId:    ${comp.id}`);
  console.log(`  Stored target_id: ${storedTargetId}`);
  console.log(`  Expected UUID:    ${comp.cuuid}`);

  const pass = storedTargetId === comp.cuuid;
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}: target_id ${pass ? 'is' : 'is NOT'} the UUID`);

  // Clean up
  await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
  return pass;
}

async function testComponentWithUuid() {
  console.log('\n=== Test 2: Component — send UUID, expect UUID stored ===');
  const components = await fetchJson(`${BASE}/components?vesselId=${VESSEL_ID}`);
  const comp = components[0];

  const cr = await fetchJson(`${BASE}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      category: 'component',
      title: 'UUID resolution test - component (already UUID)',
      reason: 'Testing',
      targetType: 'component',
      targetId: comp.cuuid, // Already UUID
      status: 'draft',
      requestedByUserId: 'test-user',
      proposedChangesJson: [{ field: 'name', oldValue: comp.name, newValue: 'Test', justification: 'test' }],
    }),
  });

  const storedTargetId = await getStoredTargetId(cr.id);
  console.log(`  Sent targetId:    ${comp.cuuid}`);
  console.log(`  Stored target_id: ${storedTargetId}`);

  const pass = storedTargetId === comp.cuuid;
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}: target_id preserved as UUID`);

  await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
  return pass;
}

async function testJobWithLegacyId() {
  console.log('\n=== Test 3: Job — send legacy ID, expect UUID stored ===');
  const jobs = await fetchJson(`${BASE}/jobs?vesselId=${VESSEL_ID}`);
  const job = jobs[0];
  console.log(`  Job legacy ID: ${job.id}`);
  console.log(`  Job juuid:     ${job.juuid}`);

  const cr = await fetchJson(`${BASE}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      category: 'job',
      title: 'UUID resolution test - job',
      reason: 'Testing',
      targetType: 'job',
      targetId: job.id, // LEGACY ID like "JOB-xxx"
      status: 'draft',
      requestedByUserId: 'test-user',
      proposedChangesJson: [{ field: 'description', oldValue: '', newValue: 'Test', justification: 'test' }],
    }),
  });

  const storedTargetId = await getStoredTargetId(cr.id);
  console.log(`  Sent targetId:    ${job.id}`);
  console.log(`  Stored target_id: ${storedTargetId}`);
  console.log(`  Expected UUID:    ${job.juuid}`);

  const pass = storedTargetId === job.juuid;
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}: target_id ${pass ? 'is' : 'is NOT'} the UUID`);

  await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
  return pass;
}

async function testSpareWithLegacyIntegerId() {
  console.log('\n=== Test 4: Spare — send legacy integer ID, expect UUID stored ===');
  const spares = await fetchJson(`${BASE}/spares/${VESSEL_ID}`);
  const spare = spares[0];
  console.log(`  Spare legacy ID: ${spare.id} (integer)`);
  console.log(`  Spare suuid:     ${spare.suuid}`);

  const cr = await fetchJson(`${BASE}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      category: 'spare',
      title: 'UUID resolution test - spare',
      reason: 'Testing',
      targetType: 'spare',
      targetId: String(spare.id), // Legacy integer as string
      status: 'draft',
      requestedByUserId: 'test-user',
      proposedChangesJson: [{ field: 'partName', oldValue: spare.partName, newValue: 'Test', justification: 'test' }],
    }),
  });

  const storedTargetId = await getStoredTargetId(cr.id);
  console.log(`  Sent targetId:    ${spare.id}`);
  console.log(`  Stored target_id: ${storedTargetId}`);
  console.log(`  Expected UUID:    ${spare.suuid}`);

  const pass = storedTargetId === spare.suuid;
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}: target_id ${pass ? 'is' : 'is NOT'} the UUID`);

  await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });
  return pass;
}

async function testApprovalWithResolvedUuid() {
  console.log('\n=== Test 5: Full approve flow — legacy ID → UUID stored → applied correctly ===');
  const components = await fetchJson(`${BASE}/components?vesselId=${VESSEL_ID}`);
  const comp = components[0];
  const originalName = comp.name;
  const newName = `UUID-Test-${Date.now()}`;

  // Create with legacy ID
  const cr = await fetchJson(`${BASE}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      category: 'component',
      title: 'Full approval UUID test',
      reason: 'Testing full flow',
      targetType: 'component',
      targetId: comp.id, // LEGACY ID
      status: 'submitted',
      requestedByUserId: 'test-user',
      proposedChangesJson: [{ field: 'name', oldValue: originalName, newValue: newName, justification: 'test' }],
    }),
  });

  // Verify UUID was stored
  const storedTargetId = await getStoredTargetId(cr.id);
  const uuidStored = storedTargetId === comp.cuuid;
  console.log(`  Stored target_id: ${storedTargetId} (${uuidStored ? 'UUID ✅' : 'NOT UUID ❌'})`);

  // Approve
  const approved = await fetchJson(`${BASE}/change-requests/${cr.id}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ comment: 'Approved', reviewerId: 'test-reviewer' }),
  });
  console.log(`  Approval status: ${approved.status}`);

  // Verify component was updated (check directly via DB)
  const pool = new pg.Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT name FROM components WHERE cuuid = $1', [comp.cuuid]);
    const dbName = res.rows[0]?.name;
    const applied = dbName === newName;
    console.log(`  Component name in DB: "${dbName}" (${applied ? 'APPLIED ✅' : 'NOT APPLIED ❌'})`);

    // Revert
    await client.query('UPDATE components SET name = $1 WHERE cuuid = $2', [originalName, comp.cuuid]);

    // Clean up CR
    await fetch(`${BASE}/change-requests/${cr.id}`, { method: 'DELETE' });

    return uuidStored && applied;
  } finally {
    client.release();
    await pool.end();
  }
}

async function testGetTargetEntityReturnsUuid() {
  console.log('\n=== Test 6: GET target-entity returns UUID not legacy ID ===');
  const components = await fetchJson(`${BASE}/components?vesselId=${VESSEL_ID}`);
  const comp = components[0];

  // Call target-entity with legacy ID
  const result = await fetchJson(`${BASE}/change-requests/target-entity/component/${comp.id}`);
  console.log(`  Requested with legacy ID: ${comp.id}`);
  console.log(`  Returned targetId:        ${result.targetId}`);
  console.log(`  Expected UUID:            ${comp.cuuid}`);

  const pass = result.targetId === comp.cuuid;
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}: target-entity returns UUID`);
  return pass;
}

async function main() {
  console.log('Change Request UUID Resolution — Comprehensive Test');
  console.log('='.repeat(60));

  const results: { test: string; pass: boolean }[] = [];

  results.push({ test: 'Component: legacy ID → UUID stored', pass: await testComponentWithLegacyId() });
  results.push({ test: 'Component: UUID → UUID preserved', pass: await testComponentWithUuid() });
  results.push({ test: 'Job: legacy ID → UUID stored', pass: await testJobWithLegacyId() });
  results.push({ test: 'Spare: integer ID → UUID stored', pass: await testSpareWithLegacyIntegerId() });
  results.push({ test: 'Full approve: legacy → UUID → applied', pass: await testApprovalWithResolvedUuid() });
  results.push({ test: 'GET target-entity: returns UUID', pass: await testGetTargetEntityReturnsUuid() });

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS:');
  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.test}`);
  }
  const passed = results.filter(r => r.pass).length;
  console.log(`\n${passed}/${results.length} tests passed`);
  if (passed < results.length) process.exit(1);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
