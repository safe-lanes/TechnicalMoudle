/**
 * Regression harness — Admin → Approval Workflow follows ACCESS CONTROL (25-Sep-2026, Sahil).
 * Engine config writes (save chain / switch action) need Edit on 'approval-workflow-pms' (technical)
 * or 'approval-workflow-defects' (defects); Defects diagnostics/settings need View / Edit on the
 * Defects menu; roles with no Access Control rows are refused; the old Level 1/2 save is 410.
 * Runs against the throwaway shore (default :5077 on pms_ae_test, whose role permissions are the
 * pilot copy). Cleans up the chain it saves.
 *   npx tsx scripts/test-approval-access-control.ts
 */
import { Pool } from 'pg';
const B=process.env.AE_TEST_BASE || 'http://localhost:5077/technical/api';
const who=(role,type='Office')=>({'Content-Type':'application/json','x-user-id':'perm-'+role.replace(/\W/g,''),'x-user-name':'Perm','x-user-role':encodeURIComponent(role),'x-user-type':type,'x-rank':'Technical Superintendent'});
const chain={scope:{moduleId:'technical',screenId:'pms-stores-cr',actionId:''},classification:'Store Items',mode:'simple',label:'PERM chain',nodes:[{key:'step-1',type:'approval-step',label:'S',ordinal:0,quorum:{rule:'any'},slots:[{roleId:'28893a97-e475-4e19-afc5-d17f1b9adbb6',roleLabel:'Admin'}]},{key:'end',type:'end',label:'End',ordinal:1}],edges:[{from:'step-1',to:'end'}]};
const call=async(m,p,b,h)=>{const r=await fetch(B+p,{method:m,headers:h,body:b?JSON.stringify(b):undefined});return r.status};
const rows=[];
rows.push(['old Level1/2 save (Sail Admin)', await call('PUT','/admin/approval-workflow-config',{rows:[]},who('Sail Admin')), 410]);
rows.push(['save chain as Admin (OLDBUILD-MATCHED) — has Edit', await call('POST','/approval-engine/workflows',chain,who('Admin (OLDBUILD-MATCHED)')), 201]);
rows.push(['save chain as Vessel Admin — View only', await call('POST','/approval-engine/workflows',chain,who('Vessel Admin','Ship')), 403]);
rows.push(['save chain as Office — no Access Control rows', await call('POST','/approval-engine/workflows',chain,who('Office')), 403]);
rows.push(['switch action off as Vessel Admin', await call('PUT','/approval-engine/scopes/enabled',{scope:chain.scope,enabled:false},who('Vessel Admin','Ship')), 403]);
rows.push(['defects diagnostics as Vessel Admin — View', await call('GET','/defects/approval-diagnostics',undefined,who('Vessel Admin','Ship')), 200]);
rows.push(['defects diagnostics as Office — no rows', await call('GET','/defects/approval-diagnostics',undefined,who('Office')), 403]);
rows.push(['defects settings save as Vessel Admin — View only', await call('PUT','/defects/approval-settings',{long_extension_days:90,show_rejected_closures_on_report:false},who('Vessel Admin','Ship')), 403]);
rows.push(['defects settings save as Admin (OLDBUILD-MATCHED) — Edit', await call('PUT','/defects/approval-settings',{long_extension_days:90,show_rejected_closures_on_report:false},who('Admin (OLDBUILD-MATCHED)')), 200]);
rows.push(['unknown module in scope → 400', await call('POST','/approval-engine/workflows',{...chain,scope:{...chain.scope,moduleId:'nope'}},who('Sail Admin')), 400]);
let f=0; for(const [l,got,exp] of rows){const ok=got===exp; if(!ok)f++; console.log(`${ok?'PASS':'FAIL'}  ${l}: ${got} (expected ${exp})`);} console.log(`RESULT: ${rows.length-f} passed, ${f} failed`);
const DB = process.env.AE_TEST_DB || 'pms_ae_test';
if (!DB.endsWith('_test')) { console.error(`refusing: database '${DB}' is not a *_test database`); process.exit(2); }
const pool = new Pool({ connectionString: `postgres://postgres:admin123@localhost:5432/${DB}` });
await pool.query(`DELETE FROM apprv_workflows WHERE label='PERM chain'`);
await pool.end();
process.exit(f ? 1 : 0);
