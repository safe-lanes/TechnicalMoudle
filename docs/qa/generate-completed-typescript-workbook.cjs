/**
 * Generate and audit a QA specification, not an application test runner.
 * Reads source/history/evidence only; writes the workbook and its content audit.
 * Usage: node docs/qa/generate-completed-typescript-workbook.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ExcelJS = require('exceljs');
const { groups, c } = require('./completed-typescript-case-catalog.cjs');
const PG = 'server/postgresStorage.ts';
const mod = name => `server/modules/${name}`;
const outputDir = path.join(__dirname, 'output');
const output = path.join(outputDir, 'Completed_TypeScript_Fixes_QA_Test_Cases.xlsx');
const baselinePath = 'attached_assets/Pasted--workspace-npx-tsc-noEmit-client-src-components-RichTex_1790659743857.txt';
const laterPath = 'attached_assets/Pasted--workspace-npx-tsc-noEmit-client-src-components-RichTex_1790674464915.txt';
const prepared = '2026-10-05';
const batchCommits = {
  'WO blockers': '0dace030b', 'History date': 'd3a253e6e',
  'Hydration iteration': 'f95b6e307', 'Form cleanup': '0db0bdeb1',
  'Component context': '914b04d07', 'Component access': '914b04d07',
  'Noon exports': 'a0c23b92d', 'Work Order form': 'd10589e6b',
  'Change Request summaries': '9f201e951', 'Certificate admin': '04980ef89',
  'Localized 17': 'f01c6e84a', 'Compliance/report': '017e530b2',
  'Bounded contracts': '6f7e278cd', 'Follow-on compatibility': '7b97f8211',
  'Low-impact 10': '0c64c08f1', 'Bounded storage 3': '0bbabc694',
};
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 3e6 }).trim();
const batchEvidence = Object.fromEntries(Object.entries(batchCommits).map(([batch, commit]) =>
  [batch, git(['show', '-s', '--format=%h | %ad | %s', '--date=short', commit])]));
batchEvidence['Historical role type'] = 'Current UserRole declaration + historical plan; implementation commit/date not reconciled.';
const parseDiagnostics = file => {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const matches = [...text.matchAll(/^((?:client|server|shared)\/[^\s:]+):(\d+):(\d+) - error (TS\d+): ([^\n]+)/gm)];
  return matches.map(m => ({ file: m[1], line: +m[2], column: +m[3], code: m[4],
    message: m[5].replace(/\r$/, ''), source: file,
    key: `${m[1]}:${m[2]}:${m[3]}:${m[4]}` }));
};
// Earliest attachment supplies the original positions. Repeated pasted diagnostics
// are deduplicated by full location/code; baseline counts are not fix counts.
const original = parseDiagnostics(baselinePath);
const later = parseDiagnostics(laterPath);
const uniqueOriginal = [...new Map(original.map(d => [d.key, d])).values()];
const diagnosticMap = [];
const unclaimed = [];
const sourceAnchor = {
  F001: 'isWorkOrderB3Applicable', F002: 'picker-icon', F003: 'executionData.currentReadingDate',
  F004: 'template.currentReadingDate', F005: 'jobsByVesselAndNumber.forEach',
  F007: 'const exportJobTitle', F008: 'executionAssignedTo:', F009: 'handleReviewerChange',
  F010: 'handleSafetyRequirementsChange', F011: 'displayData.map',
  F012: 'vesselId', F013: 'assertShipVesselAccess', F048: 'getAlertAcknowledgements',
  F049: 'const mergedLinks = Array.from', F050: 'type CompanyStandardGraceSettings',
  F051: 'const workOrderIds = Array.from', F052: 'Array.from(linkedSpareIds)',
  F053: 'serverOptions: ServerOptions', F054: 'Array.from(teamUuids)', F055: 'component.name',
  F056: 'async createComponent', F057: 'async createFleetScopedComponent',
  F058: 'Array.from(defectGroups)', F059: '"External 10"',
};
const sourceCache = new Map();
const source = file => {
  if (!sourceCache.has(file)) sourceCache.set(file, fs.readFileSync(file, 'utf8'));
  return sourceCache.get(file);
};
function diagnosticOwner(d) {
  const text = `${d.file}:${d.line}:${d.column} ${d.code} ${d.message}`;
  if (d.file.endsWith('/ReportsExport.tsx')) return groups.find(g => g.id === (/Promise<Response>|MutationFunction/.test(d.message) ? 'F015' : 'F014'));
  if (d.file === 'server/modules/alerts/repositories/alertsRepository.ts') return groups.find(g => g.id === 'F048');
  const candidates = groups.filter(g => g.file === d.file && g.selector.test(text));
  if (candidates.length > 1) throw new Error(`Ambiguous original diagnostic: ${d.key}: ${candidates.map(g => g.id)}`);
  return candidates[0];
}
for (const d of uniqueOriginal) {
  const owner = diagnosticOwner(d);
  if (owner) diagnosticMap.push({ ...d, fix: owner.id, confidence: 'Original attachment header recovered; implemented scope matched' });
  else unclaimed.push(d);
}
// The compiler header is absent for several fixes implemented before the first
// attachment. Retain those source-confirmed repairs without inventing codes/positions.
for (const g of groups) {
  if (g.id !== 'F006' && !fs.existsSync(g.file)) throw new Error(`Missing source for ${g.id}: ${g.file}`);
  const anchor = sourceAnchor[g.id];
  if (anchor && !source(g.file).includes(anchor)) throw new Error(`Missing current-source anchor for ${g.id}: ${anchor}`);
  g.currentLocation = g.id === 'F006' ? 'Deleted module; no active route'
    : `${g.file}${anchor ? ':' + (source(g.file).slice(0, source(g.file).indexOf(anchor)).split('\n').length) : ''}`;
  g.diagnostics = diagnosticMap.filter(d => d.fix === g.id);
  g.provenance = batchEvidence[g.batch];
  if (!g.diagnostics.length) {
    const item = { fix: g.id, file: g.file, line: null, column: null, code: 'Not recovered',
      message: g.id === 'F006' ? 'Removed obsolete source; original diagnostic header not recovered.'
        : 'Implemented correction established by history/current source; original diagnostic header not recovered.',
      source: `${g.provenance}; ${g.evidence || g.file}`,
      confidence: 'Source/history confirmation only; original position/code uncertain' };
    g.diagnostics.push(item);
    diagnosticMap.push(item);
  }
}
const modules = [...new Set(groups.map(g => g.module))];
const detailed = [];
const caseRow = (g, spec, sheet, ordinal, overrides = {}) => ({
  id: `TC-${String(ordinal).padStart(3, '0')}`, fixes: [g.id], module: g.module,
  scenario: spec.scenario, priority: /Inventory|Storage|Components/.test(g.module) || /Runtime/.test(g.kind) ? 'P1' : 'P2',
  level: g.level, role: g.role,
  preconditions: `Nonproduction/disposable fixture environment; identify the tested code revision and existing permissions. ${g.level.includes('Manual') || g.level.includes('manual') ? 'Use a synthetic QA record, not a live vessel operation.' : 'Use isolated boundaries; do not connect fixtures to live storage/network.'} Read ${g.currentLocation}.`,
  data: spec.data,
  steps: ['Prepare the stated independent fixture(s).', ...spec.actions.split('\n'),
    'Capture the stated outputs/call traces and record evidence against this Case ID.'].map((s, i) => `${i + 1}. ${s}`).join('\n'),
  expected: spec.expected,
  assertions: spec.assertions || 'No additional persistence/identity/logging contract is changed by this local correction. Inspect the existing payload where the scenario invokes a save; never infer live sync from mocked calls.',
  cleanup: /manual|API|local storage/i.test(g.level) ? 'Restore/delete only the disposable QA draft/local-session data under the test-environment policy; retain sanitized evidence. Do not delete production records.'
    : 'Reset mocks, frozen clocks, DOM harness and fixture state; remove temporary comparison output; retain sanitized traces.',
  evidence: `${g.evidence || 'Current source + implementation diff; no separate historical run result recovered'}\n${g.provenance}`,
  status: 'Not Run', actual: null, tester: null, date: null,
  remarks: 'Specification only; not executed during workbook preparation. Multiple fixture variants must each be checked before marking this case Passed.',
  sheet, ...overrides,
});
for (const g of groups) {
  for (const spec of g.cases) detailed.push(caseRow(g, spec, `Cases - ${g.module}`, detailed.length + 1));
}
const compilerCases = [];
for (const g of groups) {
  const locations = g.diagnostics.map(d => d.line ? `${d.file}:${d.line}:${d.column} ${d.code}` : `${d.file} — original header not recovered`).join('\n');
  const declarationOnly = /Declaration-only|Type imports|Interface-only/.test(g.kind);
  const spec = c(`Diagnostic/contract safeguard — ${g.summary}`,
    `${g.id}; existing tsconfig/package lock; original snapshot locations (historical, not necessarily current):\n${locations}`,
    `In an authorized future verification session, capture full output of npx tsc --noEmit using unchanged configuration.\nMatch the corrected expression/contract at ${g.currentLocation}, not only historical line numbers.\nCompare file, line, column, code and full message against a fresh pre-change inventory; map intentional line shifts.\n${declarationOnly ? 'Compare baseline/candidate emitted JavaScript with identical ES2020/ESNext options for the declaration-only phase; retain byte/text comparison.' : 'Inspect the implementation diff for only the approved expression/collection/typing change; do not alter compiler target or add suppression.'}`,
    `${g.diagnostics.every(d => d.line) ? 'The listed original diagnostic(s) no longer occur at their corrected source expressions.' : 'The corrected source contract compiles; an exact original-header removal count cannot be recovered for this item.'} Remaining diagnostics are reported separately; a successful production build does not imply a clean compiler. ${declarationOnly ? 'Declaration-only executable emission must be identical.' : 'Runtime differences are limited to the documented correction; representative cases cover preserved behavior.'}`,
    'No schema/interface expansion beyond the approved declaration, no sync/auth changes, no unsafe suppressions. Compiler failure from the remaining baseline is not automatically a failure of this scoped case.');
  compilerCases.push(caseRow(g, spec, 'Compiler & Build Cases', detailed.length + compilerCases.length + 1,
    { module: 'Compiler & Build', level: 'Developer/compiler', role: 'Developer; authorized future verification window', priority: 'P1',
      preconditions: 'Working revision, compiler version and lockfile recorded; unchanged tsconfig; full baseline capture retained; original headers may predate current line positions.',
      cleanup: 'Remove temporary compiler/emission comparison files outside tracked source; do not change compiler configuration.' }));
}
const globalSpecs = [
  c('Complete compiler inventory is transparent', 'Latest recorded report: 128 errors overall, 23 storage (2026-10-05); this is historical evidence, not a new run.',
    'Capture complete compiler output in an authorized future session.\nCount diagnostic headers by file/code; compare full messages and line shifts.\nSeparate resolved inventory from remaining errors and any new diagnostics.',
    'All remaining errors stay visible; expected current baseline is historical 128/23 only for the same revision/configuration. Drift is explained, never hidden or attributed to workbook generation.'),
  c('Production build and tracked-filename check', 'Existing npm run build command, lockfile and tracked source; historical warnings include bundle size/mixed imports.',
    'In a future verification session run npm run build and record exit code/output.\nInspect tracked-filename validation and build artifacts.\nClassify pre-existing warnings separately.',
    'Build completes for the tested revision; no invalid tracked filenames or new build errors. Build success does not override TypeScript diagnostics or mark operational cases Passed.'),
  c('Startup smoke check is separate from authenticated operational QA', 'Existing Start application workflow; historical preview/dashboard only; startup can run normal migration/self-heal routines.',
    'Use an authorized disposable environment and record database/startup prerequisites.\nStart the existing workflow once only if needed for actual future QA.\nInspect startup logs and public dashboard/sign-in availability.\nRun authenticated cases separately with real role/vessel sessions.',
    'Service becomes available with no new startup failures; distinguish public/dashboard rendering from signed-in changed flows. Never disable auth to obtain screenshots.'),
  c('Real persistence and two-instance sync are separate verification', 'Dedicated ship/shore QA instances with synthetic vessel, component/spare UUIDs, different local IDs and sanitized field-log evidence.',
    'Prepare approved disposable records and existing sync configuration.\nExecute only scoped operational cases with real identity sessions.\nInspect PostgreSQL constraints, field-log persistence and receiving-side UUID/ownership associations.\nRecord delivery/retry behavior separately from local fixture traces.',
    'Canonical IDs and vessel ownership survive the existing sync path; intended writes have actual persisted logs. Until this is run, the workbook and historical isolated probes do not certify live sync or concurrency.'),
];
for (const spec of globalSpecs) compilerCases.push({
  ...caseRow(groups[0], spec, 'Compiler & Build Cases', detailed.length + compilerCases.length + 1),
  fixes: groups.map(g => g.id), module: 'Compiler & Build', priority: 'P1', level: 'Developer/integration (future)',
  role: 'Authorized QA/developer; disposable environments only', preconditions: 'Approved future execution window and backups/disposable fixtures; no operational checks run during document generation.',
  evidence: 'docs/low-impact-typescript-fix-report.md; docs/bounded-storage-typescript-fix-report.md; current package.json',
  remarks: 'Cross-cutting safeguard; not a claim that every fix affects sync or has an active UI route.',
});
const allCases = [...detailed, ...compilerCases];
const caseColumns = [
  ['Case ID','id',13],['Fix ID(s)','fixes',18],['Module/Feature','module',23],['Scenario','scenario',42],
  ['Priority','priority',10],['Test Level','level',24],['Role/Access Context','role',34],
  ['Preconditions','preconditions',48],['Test Data','data',53],['Numbered Steps','steps',62],
  ['Expected Result','expected',65],['Persistence/Identity/Logging Assertions','assertions',56],
  ['Cleanup','cleanup',42],['Evidence Reference','evidence',53],['Execution Status','status',18],
  ['Actual Result','actual',45],['Tester','tester',22],['Execution Date','date',20],['Remarks','remarks',45],
];
const workbook = new ExcelJS.Workbook();
workbook.creator = 'QA documentation';
workbook.title = 'Completed TypeScript Fixes — QA Test Cases';
workbook.subject = 'Unexecuted, traceable QA specification';
workbook.description = 'Documentation only. All execution statuses initially Not Run.';
workbook.created = new Date('2026-10-05T00:00:00Z');
workbook.modified = workbook.created;
const navy = '18344F', blue = '175D88', light = 'EFF5FA';
const link = (text, sheet, row = 4) => ({ text, hyperlink: `#'${sheet}'!A${row}` });
function sheet(name, columns, subtitle) {
  const ws = workbook.addWorksheet(name);
  ws.columns = columns.map(([header,key,width]) => ({ key, width }));
  ws.mergeCells(1,1,1,columns.length);
  ws.getCell('A1').value = name;
  ws.getCell('A1').fill = { type:'pattern',pattern:'solid',fgColor:{argb:navy} };
  ws.getCell('A1').font = { name:'Calibri',size:18,bold:true,color:{argb:'FFFFFF'} };
  ws.getRow(1).height = 32;
  ws.getCell('A2').value = link('Read Me','Read Me');
  ws.getCell('A2').font = { color:{argb:blue},underline:true };
  ws.mergeCells(2,3,2,columns.length);
  ws.getCell('C2').value = subtitle;
  ws.getCell('C2').alignment = { wrapText:true,vertical:'middle' };
  ws.getRow(2).height = 34;
  const head = ws.getRow(4);
  columns.forEach(([header],i) => head.getCell(i+1).value=header);
  head.height = 30;
  head.eachCell(cell => {
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:blue}};
    cell.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFF'}};
    cell.alignment={wrapText:true,vertical:'middle'};
  });
  ws.views=[{state:'frozen',xSplit:Math.min(3,columns.length-1),ySplit:4,activeCell:'D5'}];
  ws.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:4',
    margins:{left:0.25,right:0.25,top:0.5,bottom:0.5,header:0.2,footer:0.2}};
  ws.headerFooter={oddFooter:'&LQA specification — not executed&CPage &P of &N'};
  return ws;
}
function append(ws, values, height = 130) {
  const row = ws.addRow(values);
  row.height = height;
  row.eachCell({includeEmpty:true}, cell => {
    cell.alignment={wrapText:true,vertical:'top'};
    cell.font={name:'Calibri',size:11,color:{argb:'243745'}};
    if(row.number%2) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:light}};
    if(cell.value && typeof cell.value==='object' && cell.value.hyperlink) cell.font={name:'Calibri',size:11,color:{argb:blue},underline:true};
  });
  return row;
}
function finish(ws, columns) {
  ws.autoFilter={from:{row:4,column:1},to:{row:ws.rowCount,column:columns}};
  ws.pageSetup.printArea=`A1:${ws.getColumn(columns).letter}${ws.rowCount}`;
}
const readMe = sheet('Read Me',[['Topic','topic',26],['Details','details',115],['Navigation','navigation',34]],'Prepared 05 Oct 2026 • Documentation only • No application, compiler, build, API, email or live-data checks run');
const coverage = sheet('Fix Coverage',[
  ['Fix ID','fix',12],['Module','module',22],['Batch','batch',26],['Fix Summary','summary',66],
  ['Change Kind','kind',30],['Current Source','current',55],['Original Code(s)','codes',24],
  ['Original Diagnostic Location(s)','locations',62],['Implementation Evidence','history',58],
  ['Historical Test/Evidence Reference','evidence',57],['Detailed Case IDs','cases',45],
  ['Compiler Case ID','compiler',22],['Open Cases','navigation',25],['Uncertainty/Limitations','limits',56],
], 'One unique Fix ID per deduplicated repair group; diagnostic positions refer to historical snapshots, not current line numbers');
const diagSheet=sheet('Diagnostic Map',[
  ['Diagnostic ID','id',17],['Fix ID','fix',12],['Original File','file',62],['Original Line','line',14],
  ['Original Column','column',14],['Code','code',18],['Original Header Message','message',93],
  ['Evidence Source','source',65],['Confidence/Uncertainty','confidence',62],['Open Fix','navigation',18],
], 'Recovered headers are deduplicated by file/line/column/code; missing original headers are labelled rather than invented');
const evidenceSheet=sheet('Historical Evidence',[
  ['Evidence ID','id',17],['Context/Date','context',40],['Recorded Result','result',75],
  ['Reference','reference',66],['Limitations','limitations',78],
], 'Historical results only; none are executions of this workbook’s cases');
const gapSheet=sheet('Known Gaps',[
  ['Gap ID','id',14],['Area','area',35],['Unresolved/Unverified Item','item',82],
  ['Impact/Execution Boundary','impact',80],['Evidence','evidence',65],['Related Fixes','fixes',32],
], 'Unresolved defects and unavailable verification are not counted as completed repairs');
const rowMap = new Map();
for(const module of modules) {
  const ws=sheet(`Cases - ${module}`,caseColumns, 'Every fixture variant must be verified • All cases start Not Run • Enter actual result/tester/date only after execution');
  for(const item of detailed.filter(c=>c.module===module)) {
    const row=append(ws,caseColumns.map(([,key])=>Array.isArray(item[key])?item[key].join(', '):item[key]), 240);
    rowMap.set(item.id,{sheet:ws.name,row:row.number});
    row.getCell(2).value=link(item.fixes[0],'Fix Coverage',5+groups.findIndex(g=>g.id===item.fixes[0]));
    row.getCell(15).dataValidation={type:'list',allowBlank:false,formulae:['"Not Run,Passed,Failed,Blocked,Not Applicable"'],showErrorMessage:true,errorTitle:'Choose an execution status',error:'Use the list values.'};
    row.getCell(15).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1CC'}};
  }
  finish(ws,caseColumns.length);
}
const compilerSheet=sheet('Compiler & Build Cases',caseColumns,'Future execution instructions only • Historical compiler baseline is not clean • No checks run to prepare this document');
for(const item of compilerCases) {
  const row=append(compilerSheet,caseColumns.map(([,key])=>Array.isArray(item[key])?item[key].join(', '):item[key]),260);
  rowMap.set(item.id,{sheet:compilerSheet.name,row:row.number});
  row.getCell(15).dataValidation={type:'list',allowBlank:false,formulae:['"Not Run,Passed,Failed,Blocked,Not Applicable"'],showErrorMessage:true,error:'Use a listed status.'};
  row.getCell(15).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1CC'}};
}
finish(compilerSheet,caseColumns.length);
groups.forEach(g=>{
  const cases=detailed.filter(c=>c.fixes.includes(g.id));
  const cc=compilerCases.find(c=>c.fixes.length===1&&c.fixes[0]===g.id);
  const first=rowMap.get(cases[0].id);
  append(coverage,[g.id,g.module,g.batch,g.summary,g.kind,g.currentLocation,
    [...new Set(g.diagnostics.map(d=>d.code))].join('\n'),
    g.diagnostics.map(d=>d.line?`${d.file}:${d.line}:${d.column}`:`${d.file} — original location not recovered`).join('\n'),
    g.provenance,g.evidence||'Source/history only; no separate executed regression result recovered',
    cases.map(c=>c.id).join(', '),link(cc.id,'Compiler & Build Cases',rowMap.get(cc.id).row),
    link('Open detailed cases',first.sheet,first.row),
    `${g.diagnostics.some(d=>!d.line)?'Original diagnostic code/position incomplete; ':''}${g.id==='F059'?'Older role type retained; implementation date not recovered. ':''}Source/fixture evidence does not certify live UI/database/sync; see Known Gaps.`],190);
});
diagnosticMap.forEach((d,i)=>append(diagSheet,[
  `DG-${String(i+1).padStart(3,'0')}`,d.fix,d.file,d.line??'Not recovered',d.column??'Not recovered',
  d.code,d.message,d.source,d.confidence,link(d.fix,'Fix Coverage',5+groups.findIndex(g=>g.id===d.fix)),
],125));
const historical = [
  ['Implementation history', 'Sixteen implementation batches + older role declaration were reconciled using current source and git history; task status alone was not treated as proof.', 'Fix Coverage / implementation commit references', 'This establishes implemented scope, not executed QA. Some old original headers/run outputs are unavailable.'],
  ['2026-10-05 • Low-impact corrections', 'Report records 141→131 diagnostics; 40 new isolated checks; 152 ordinary passes and four existing expected failures across selected suites; build/startup/dashboard passed historically.', 'docs/low-impact-typescript-fix-report.md', 'Fixtures, not real DB constraints, authenticated changed flows, concurrency or receiving-side sync. Emission equality applies to declaration-only phase.'],
  ['2026-10-05 • Storage corrections', 'Report records 131→128 overall and 26→23 storage; exactly three headers removed with no added/changed headers; 20 new isolated checks; 62 existing passes plus two expected failures; historical build/startup/dashboard check.', 'docs/bounded-storage-typescript-fix-report.md; server/__tests__/boundedStorageRegression.test.cjs', 'No live authenticated create/edit or two-instance sync. Unsupported isRecurring field deliberately unresolved.'],
  ['2026-10-05 • Severe review, not implementation', '37 isolated review checks including four expected failures; with existing suites: 112 ordinary passes plus four expected failures. Review authorized no production correction.', 'docs/severe-risk-impact-report.md', 'Later feedback-only correction resolved one reviewed diagnostic; other twenty lifecycle/identity findings remain unresolved. Expected failure is evidence of a defect, not a passing repair.'],
  ['Certificate/component/report/view fixtures', 'Existing test source was read for input/expected contracts. No fresh run performed; no unstated historical pass claimed.', 'certAdminApplicability.test.ts; subEntityVesselAccess.test.ts; boundedViewContracts.test.ts; boundedSpareIdContracts.test.ts; lowImpactTypeFixes.test.ts', 'Mocked or isolated transport/SQL boundaries; not live operational or authenticated-session proof.'],
  ['Compiler attachments', `Earliest attachment contains ${original.length} recovered header occurrences (${uniqueOriginal.length} unique); later attachment has ${later.length} occurrences. Repeated pasted headers are not separate repairs.`, `${baselinePath}\n${laterPath}`, 'Snapshots predate later edits; baseline reductions are not a count of fix groups. Original full multi-line compiler messages are not reproduced in header-only Diagnostic Map.'],
];
historical.forEach((r,i)=>append(evidenceSheet,[`EV-${String(i+1).padStart(3,'0')}`,...r],145));
const gaps = [
  ['Compiler baseline','128 total / 23 storage diagnostics remain in latest recorded 2026-10-05 evidence.','No globally clean compiler claim; fresh counts depend on revision/configuration.','docs/bounded-storage-typescript-fix-report.md','All'],
  ['Recurrence field','Unsupported isRecurring update property is not corrected by Map iteration.','Loop compatibility preserves attempted payloads; actual recurrence persistence/DB support is unverified/unresolved.','docs/bounded-storage-typescript-fix-report.md','F058'],
  ['Expected-failure defects','Stock UUID omission; completed-parent document deletion protection; Approved history suppression by SKIPPED history; repeated dedicated Calendar backfill duplicates.','Existing expected-failure reproductions document unresolved defects. Do not mark workbook cases or production lifecycle Passed based on suite summary.','docs/severe-risk-impact-report.md','Adjacent only'],
  ['Severe lifecycle/identity scope','Twenty reviewed diagnostics remain after feedback fix: import factory caller contract, inheritance context, stock ownership, documents, history/backfill/frequency, unplanned numbering and audit-vessel policy.','Review acceptance was not implementation approval. Keep approved candidate policy separate from current behavior.','docs/severe-risk-impact-report.md; docs/low-impact-typescript-fix-report.md','F055 adjacent'],
  ['IHM editing','Read-projection types repaired; endpoint reachability and fixed V001 save-vessel behavior not established/repaired.','No live save/upload made. Hydration checks cannot certify persistence on a selected vessel.','docs/severe-risk-impact-report.md (Adjacent IHM issue)','F030'],
  ['Authenticated roles','Controller fixture retains existing forwarded-role/mock-user behavior; real session enforcement not proven by type normalization.','Use actual Ship/Office/Admin sessions for operational QA; do not expand permissions to make testing possible.','server/modules/components/__tests__/subEntityControllerUserInfo.test.ts','F012,F013,F031,F059'],
  ['Real DB and sync','PostgreSQL constraints, actual field-log persistence, concurrent writes and receiving-side ship/shore remapping were not executed for this workbook.','Controlled fixtures validate payloads/call order only; two-instance tests require dedicated approved QA environments.','docs/low-impact-typescript-fix-report.md; docs/bounded-storage-typescript-fix-report.md','F034-F036,F049-F052,F056-F058'],
  ['Certificate numbering','Stale client lists can race when deriving local certificate IDs/sequences.','Required-field narrowing retains existing numbering; no concurrency/unique-allocation correction asserted.','.local/tasks/fix-17-localized-typescript-errors.md','F021'],
  ['Archived/removed surfaces','Archived change-request screen remains inactive; obsolete factory removed; legacy RH validator has no confirmed active caller.','Use compiler/source checks, not invented navigation. Do not reactivate an archived screen for manual QA.','Current source + Fix Coverage','F006,F029,F038'],
  ['Evidence recovery','Some early original diagnostic headers, execution dates and full run outputs could not be recovered.','Uncertainty is explicit in Diagnostic Map; source-confirmed repair groups are not a precise recovered historical diagnostic total.','Diagnostic Map; Historical Evidence','F001-F006,F012-F013,F059 as applicable'],
  ['Separate backlog','Pending Approval completion inconsistency, broad RH lifecycle, rotational import undo, permissions/sync-role preservation, certificate seeding, audit-column backfill and Component Register work remain separate.','These are not declared fixed or tested by this documentation deliverable.','Existing project backlog + accepted scope','Out of scope'],
];
gaps.forEach((r,i)=>append(gapSheet,[`GAP-${String(i+1).padStart(3,'0')}`,...r],145));
const recovered=diagnosticMap.filter(d=>d.line).length;
const readRows = [
  ['Purpose', 'Detailed QA specification for all reconciled completed TypeScript-fix batches, including earlier work. Documentation only: no new automation or application changes.', link('Fix Coverage','Fix Coverage')],
  ['Prepared / scope', `Prepared ${prepared}, Asia/Calcutta. ${groups.length} unique repair groups across ${Object.keys(batchCommits).length} reconciled implementation batches, plus an older shared-role type correction. ${allCases.length} unique cases: ${detailed.length} module cases + ${compilerCases.length} compiler/build/integration safeguards.`, link('Diagnostic Map','Diagnostic Map')],
  ['Diagnostic counting', `${recovered} unique original diagnostic locations recovered and assigned; ${diagnosticMap.length-recovered} repair groups have labelled source/history-only entries because an original header is not recoverable. Fix group count, case count and diagnostic count are different. A Set/interface correction can remove several diagnostics.`, link('Historical Evidence','Historical Evidence')],
  ['How to use', 'Filter Fix Coverage by module/batch; follow Open detailed cases or Compiler Case hyperlinks. Freeze panes retain IDs/headers. Read all prerequisite/fixture variants before executing; one case containing several variants is not Passed until every variant is checked.', link('Cases - Work Orders','Cases - Work Orders')],
  ['Execution fields', 'All cases start Not Run; Actual Result, Tester and Execution Date are blank. Status list: Not Run, Passed, Failed, Blocked, Not Applicable. Record actual outputs and sanitized evidence, tester identifier, ISO date/time with timezone and remarks only after execution.', link('Compiler & Build Cases','Compiler & Build Cases')],
  ['Test levels', 'Manual/component cases require the actual approved route or an isolated harness. Source/contract and developer-only cases have no invented UI steps. Use mocked transport for email and isolated DB boundaries for write fixtures; real integration checks need a dedicated future execution window.', link('Known Gaps','Known Gaps')],
  ['Change kinds', 'Declaration-only/type imports/interface projections must describe actual runtime values and, where relevant, preserve emitted executable code. Runtime fixes intentionally change only the approved binding/request/title/feedback behavior. Collections preserve insertion order, deduplication, payloads and update/log order.', link('Fix Coverage','Fix Coverage')],
  ['Identity / persistence', 'Do not substitute UUIDs for local IDs, fabricate a vessel or grant permissions. Record selected canonical UUID, vessel, actor, references, stock/history changes and field-log payloads for write cases. A correct mocked call is not proof of actual database persistence or sync delivery.', link('Known Gaps','Known Gaps')],
  ['Historical results', 'Historical passes/build/startup reports are in a separate sheet, with context and limitations. They do not mark these workbook cases Passed. Expected-failure reproductions remain defects. Only workbook content/structure was audited during preparation.', link('Historical Evidence','Historical Evidence')],
  ['Latest compiler evidence', 'Latest recorded baseline is 128 overall / 23 storage (05 Oct 2026). No compiler/build/runtime checks were rerun to author this file; unimplemented findings and unsupported recurrence persistence remain outside completed fix coverage.', link('Known Gaps','Known Gaps')],
  ['Safety / cleanup', 'Use disposable synthetic QA data and approved backups/environment isolation. Do not run writes or sends against live vessel records, disable auth, change schema/sync configuration or execute migration commands for a documentation exercise.', link('Compiler & Build Cases','Compiler & Build Cases')],
  ['Original/current locations', 'Original positions in Diagnostic Map come from compiler attachments. Current Source links are path/anchor locations verified while generating this document; future lines may shift. Match the expression and full diagnostic, not a stale line number alone.', link('Diagnostic Map','Diagnostic Map')],
  ['File behavior', 'Macro-free XLSX; internal navigation only. Source paths and historical git references are text, not credential links. No external data connections or automatic test execution. Generator and content audit are documentation helpers, not application test suites.', null],
];
readRows.forEach(r=>append(readMe,r,105));
for(const ws of [readMe,coverage,diagSheet,evidenceSheet,gapSheet]) finish(ws,ws.columnCount);
async function auditWrittenWorkbook() {
  const reread=new ExcelJS.Workbook();
  await reread.xlsx.readFile(output);
  const errors=[];
  const check=(condition,message)=>{if(!condition)errors.push(message);};
  const required=['Read Me','Fix Coverage','Diagnostic Map','Historical Evidence','Known Gaps','Compiler & Build Cases',...modules.map(m=>`Cases - ${m}`)];
  check(required.every(n=>reread.getWorksheet(n)), 'Missing required sheet');
  const fixes=new Set();
  const fw=reread.getWorksheet('Fix Coverage');
  for(let i=5;i<=fw.rowCount;i++){
    const id=fw.getRow(i).getCell(1).value;
    check(!fixes.has(id),`Duplicate Fix ID ${id}`);fixes.add(id);
  }
  const ids=new Set(),covered=new Set(),headers=caseColumns.map(c=>c[0]);
  for(const ws of reread.worksheets.filter(ws=>ws.name.startsWith('Cases - ')||ws.name==='Compiler & Build Cases')){
    check(ws.getRow(4).values.slice(1).join('|')===headers.join('|'),`Required columns ${ws.name}`);
    check(ws.views.some(v=>v.state==='frozen'&&v.ySplit===4),`Frozen headers ${ws.name}`);
    check(!!ws.autoFilter,`Filter ${ws.name}`);
    for(let i=5;i<=ws.rowCount;i++){
      const row=ws.getRow(i),id=row.getCell(1).value;
      check(!ids.has(id),`Duplicate Case ID ${id}`);ids.add(id);
      let refs=row.getCell(2).value;
      if(refs&&typeof refs==='object')refs=refs.text;
      for(const f of String(refs).split(',').map(f=>f.trim())){check(fixes.has(f),`Unknown Fix ID ${f} at ${id}`);covered.add(f);}
      for(let n=1;n<=15;n++)check(row.getCell(n).value!==null&&row.getCell(n).value!==undefined&&row.getCell(n).value!=='',`Required field ${n} at ${id}`);
      check(row.getCell(15).value==='Not Run',`Non-Not Run ${id}`);
      for(let n=16;n<=18;n++)check(!row.getCell(n).value,`Execution field prefilled at ${id}, column ${n}`);
      check(row.getCell(15).dataValidation.type==='list',`No status dropdown ${id}`);
      check(/1\. /.test(String(row.getCell(10).value)),`Unnumbered steps ${id}`);
    }
  }
  const dw=reread.getWorksheet('Diagnostic Map'),diagIds=new Set(),originalKeys=new Set();
  for(let i=5;i<=dw.rowCount;i++){
    const row=dw.getRow(i),id=row.getCell(1).value;
    check(!diagIds.has(id),`Duplicate Diagnostic ID ${id}`);diagIds.add(id);
    check(fixes.has(row.getCell(2).value),`Unknown diagnostic Fix ID ${id}`);
    if(typeof row.getCell(4).value==='number'){
      const key=[3,4,5,6].map(n=>row.getCell(n).value).join(':');
      check(!originalKeys.has(key),`Duplicate original diagnostic ${key}`);originalKeys.add(key);
    }
  }
  for(const ws of reread.worksheets)ws.eachRow(row=>row.eachCell(cell=>{
    const h=cell.value&&cell.value.hyperlink;
    if(h){const match=/^#'([^']+)'!A(\d+)$/.exec(h);check(!!match,`Non-internal hyperlink ${h}`);
      if(match)check(!!reread.getWorksheet(match[1])&&+match[2]<=reread.getWorksheet(match[1]).rowCount,`Invalid hyperlink ${h}`);}
    check(!cell.formula,`Unexpected formula ${ws.name}/${cell.address}`);
  }));
  check(ids.size===allCases.length,'Reopened case count mismatch');
  check(fixes.size===groups.length,'Reopened fix count mismatch');
  check([...fixes].every(f=>covered.has(f)),'Uncovered fix');
  // Scope reconciliation: every baseline header on an implemented-only surface
  // must be mapped. Headers in PG/shared schema/modular WO may intentionally remain.
  const partialFiles=new Set([PG,'shared/schema.ts',mod('work-orders/services/workOrderService.ts'),'server/services/workOrderService.ts']);
  const implementedFiles=new Set(groups.map(g=>g.file));
  implementedFiles.add('server/modules/alerts/repositories/alertsRepository.ts');
  const uncovered=unclaimed.filter(d=>implementedFiles.has(d.file)&&!partialFiles.has(d.file));
  check(uncovered.length===0,`Unmapped diagnostics on completed-only files: ${uncovered.map(d=>d.key).join(', ')}`);
  const audit={prepared,workbook:path.relative(process.cwd(),output),sheets:reread.worksheets.map(w=>w.name),
    fixGroups:fixes.size,moduleCases:detailed.length,compilerAndBuildCases:compilerCases.length,totalCases:ids.size,
    recoveredOriginalDiagnosticLocations:originalKeys.size,sourceOnlyInventoryEntries:diagnosticMap.filter(d=>!d.line).length,
    duplicatePastedHeadersIgnored:original.length-uniqueOriginal.length,errors,
    operationalChecksExecuted:false,allNewCasesNotRun:true,blankExecutionResults:true};
  fs.writeFileSync(path.join(outputDir,'workbook-content-audit.json'),JSON.stringify(audit,null,2)+'\n');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify(audit,null,2));
}
(async()=>{
  fs.mkdirSync(outputDir,{recursive:true});
  await workbook.xlsx.writeFile(output);
  await auditWrittenWorkbook();
})().catch(error=>{console.error(error);process.exitCode=1;});
