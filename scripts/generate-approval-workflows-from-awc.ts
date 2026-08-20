/**
 * Phase 2 / W5 — one-off MATRIX GENERATOR (per D-2, accepted narrowing): converts the legacy
 * approval_workflow_config (awc) Level-1/Level-2 matrix into approval-engine workflows with
 * quorum-`any` POOL slots per level ('moc:Level 1' / 'moc:Level 2' — resolved from the same
 * moc_approvers list verifyApproverForLevel admits), and writes a PER-CLIENT SUPPORT REPORT
 * (who could approve before vs after, per scope) for the cutover walkthrough.
 *
 * NOT a migration. Default is DRY-RUN; --apply writes the workflows (versioned; re-running
 * creates new versions, never edits in-flight requests). The awc table is left untouched —
 * cutover = support disables the awc levels AFTER verifying the report (workflow XOR awc).
 *
 * Run (against the target tenant DB):
 *   DATABASE_URL=postgres://... npx tsx scripts/generate-approval-workflows-from-awc.ts [--apply] [--tenant <label>]
 *
 * The approver-set equality check is ASSERTED per generated workflow:
 *   old allowed set (moc_approvers of the enabled level, modulename Technical, active)
 *   == union of card.resolveApprovers over the workflow's slots — non-equal aborts the run.
 */
import * as fs from 'fs';
import * as path from 'path';
for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
process.env.SYNC_INSTANCE_ID = process.env.SYNC_INSTANCE_ID || 'SHORE-GENERATOR';

const APPLY = process.argv.includes('--apply');
const TENANT = process.argv.includes('--tenant') ? process.argv[process.argv.indexOf('--tenant') + 1] : 'default';
const SCOPES = ['pms-components-cr', 'pms-jobs-cr', 'pms-spares-cr', 'pms-stores-cr', 'pms-wo-postponement', 'pms-wo-re-postponement'];

(async () => {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { initStorage } = await import('../server/storage');
  await initStorage();
  const { technicalApprovalCard, MOC_POOL_ROLE_L1, MOC_POOL_ROLE_L2 } = await import('../server/modules/approvals/approvalCard');
  const { DrizzleApprovalRepository } = await import('../server/modules/approval-engine');
  const { validateWorkflowV1 } = await import('../server/modules/approval-engine');
  const repo = new DrizzleApprovalRepository(pool as any);

  const awc = (await pool.query(
    `SELECT function_id, variable_name, level1_enabled, level2_enabled FROM approval_workflow_config
     WHERE is_deleted = false AND function_id = ANY($1) ORDER BY function_id, variable_name`, [SCOPES],
  )).rows;
  const mocPool = async (level: string): Promise<string[]> => (await pool.query(
    `SELECT user_uuid FROM moc_approvers WHERE approver_level = $1 AND is_active = 1 AND is_deleted = false AND modulename = 'Technical' AND user_uuid IS NOT NULL`, [level],
  )).rows.map((r) => r.user_uuid);

  const lines: string[] = [
    `# Approval cutover report — tenant: ${TENANT}`,
    `Generated ${new Date().toISOString()} · mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} · DB: ${String(process.env.DATABASE_URL).replace(/\/\/.*@/, '//***@')}`,
    ``,
    `Old model: an enabled Level means ANY member of the Technical moc_approvers list for that`,
    `level may approve. New model: the same pool, as a quorum-any slot per level — the approver`,
    `set is IDENTICAL at conversion time (asserted below). Narrowing (accepted, D-2) only occurs`,
    `if support later replaces a pool slot with named roles in the builder.`,
    ``,
    `CUTOVER RULE per scope: enable the generated workflow AND disable the awc levels together`,
    `(workflow XOR awc). The awc table itself is not dropped.`,
    ``,
  ];
  let generated = 0, skipped = 0, failures = 0;

  for (const row of awc) {
    const levels: Array<'Level 1' | 'Level 2'> = [];
    if (row.level1_enabled) levels.push('Level 1');
    if (row.level2_enabled) levels.push('Level 2');
    const scopeLabel = `${row.function_id} / ${row.variable_name}`;
    if (levels.length === 0) {
      lines.push(`- **${scopeLabel}** — no levels enabled → no workflow needed (legacy direct approval stays).`);
      skipped++;
      continue;
    }
    const before: Record<string, string[]> = {};
    for (const lvl of levels) before[lvl] = await mocPool(lvl);
    if (levels.some((l) => before[l].length === 0)) {
      lines.push(`- **${scopeLabel}** — ⚠️ SKIPPED: enabled level with an EMPTY approver pool (${levels.filter((l) => before[l].length === 0).join(', ')}). Configure moc approvers first; a workflow with an unresolvable slot would strand requests.`);
      skipped++;
      continue;
    }
    const nodes = levels.map((lvl, i) => ({
      key: `step-${i + 1}`, type: 'approval-step' as const, label: lvl, ordinal: i,
      quorum: { rule: 'any' as const },
      slots: [{ roleId: lvl === 'Level 1' ? MOC_POOL_ROLE_L1 : MOC_POOL_ROLE_L2, roleLabel: `Approver Pool — ${lvl} (moc list)` }],
    }));
    const all = [...nodes, { key: 'end', type: 'end' as const, label: 'End', ordinal: nodes.length }];
    const def = {
      scope: { moduleId: 'technical', screenId: row.function_id, actionId: '' },
      classification: row.variable_name, mode: 'simple' as const,
      label: `Migrated from approval matrix (${levels.join(' + ')})`,
      nodes: all, edges: all.slice(0, -1).map((n, i) => ({ from: n.key, to: all[i + 1].key })),
    };
    validateWorkflowV1(def);

    // approver-set equality (ASSERTED, not eyeballed): old pool == resolveApprovers of the slot
    for (let i = 0; i < levels.length; i++) {
      const after = await technicalApprovalCard.resolveApprovers(
        { tenantId: TENANT }, def.scope, nodes[i].slots[0].roleId, 'generator-probe');
      const a = [...before[levels[i]]].sort().join(',');
      const b = [...after].sort().join(',');
      if (a !== b) {
        lines.push(`- **${scopeLabel}** — ❌ EQUALITY FAILED at ${levels[i]}: before [${a}] vs after [${b}]. NOT applied.`);
        failures++;
        continue;
      }
    }
    if (lines[lines.length - 1]?.includes('EQUALITY FAILED')) continue;

    if (APPLY) await repo.saveWorkflowVersion(def, 'awc-matrix-generator');
    generated++;
    lines.push(`- **${scopeLabel}** — ${APPLY ? 'workflow SAVED (active)' : 'workflow ready (dry-run)'}: ${levels.map((l) => `${l} = any of [${before[l].join(', ')}]`).join(' → ')} — approver set UNCHANGED (asserted).`);
  }

  lines.push(``, `Summary: ${generated} workflow(s) ${APPLY ? 'saved' : 'ready'}, ${skipped} skipped, ${failures} equality failure(s).`);
  const outDir = path.resolve(process.cwd(), 'docs/output');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `approval-cutover-${TENANT}-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(outFile, lines.join('\n'));
  console.log(lines.join('\n'));
  console.log(`\nSupport report written: ${outFile}`);
  await pool.end();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GENERATOR FAILED:', e); process.exit(1); });
