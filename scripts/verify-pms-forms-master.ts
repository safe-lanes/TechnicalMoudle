/**
 * Real PostgreSQL fixture verification. Uses only uniquely named disposable
 * schemas; never changes customer rows. No production access.
 * Run: node --import tsx scripts/verify-pms-forms-master.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import express from "express";
import jwt from "jsonwebtoken";
import { once } from "node:events";
import { tenantStorage, type TenantContext } from "../server/utils/asyncLocalStorage";
import { initStorage } from "../server/storage";
import { runDrizzleMigrations } from "../server/migrations";
import * as repo from "../server/modules/forms-master/repositories/formsMasterRepository";
import * as service from "../server/modules/forms-master/services/formsMasterService";
import formsMasterRouter from "../server/modules/forms-master/formsMasterRoutes";
import { formsMasterListInput, formMasterInput, normalizeFormName } from "../shared/pmsFormsMasterContracts";
import { createDefaultDevelopmentUser } from "../shared/developmentUser";
import { getTablesByCategory, getSyncPhaseOrder, SYNC_CONFIG } from "../shared/syncConfig";
import { applyOneWayRows } from "../server/modules/sync/oneWayApplier";
import { formsMasterProvisioningWhere, formsMasterReferencedRoles } from "../server/modules/forms-master/services/formsMasterSyncPolicy";
import { importProvisioningBundle, verifyBundleExportIntegrity, type ProvisioningBundle } from "../server/modules/sync/provisioningService";
import { mockAuthMiddleware } from "../server/middleware/auth";
import { readVerifiedUser } from "../server/middleware/tenantMiddleware";
import { tenantConnectionManager } from "../server/utils/tenantConnectionManager";
import { requestContextMiddleware } from "../server/middleware/requestContext";
import { PMS_FORM_DEFAULTS } from "../server/modules/forms-master/defaults/pmsFormsMasterSeedData";
import { initializePmsFormsMasterTenant } from "../server/modules/forms-master/defaults/pmsFormsMasterSeeder";

const root = process.cwd();
// Synthetic credentials live only in THIS disposable test process. No configured
// secret is read, persisted, logged or changed in the running application.
const fixtureJwtKey = randomUUID() + randomUUID();
const fixtureTenantJwtKey = randomUUID() + randomUUID();
process.env.JWT_SECRET = fixtureJwtKey;
let fixtureTenantMode = false;
const nativePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const contexts: TenantContext[] = [];
const schemaNames: string[] = [];
const stats: string[] = [];
const actor = randomUUID(), vesselUuid = randomUUID(), roleUuid = randomUUID(), menuUuid = randomUUID();
const sqlFile = await fs.readFile(path.join(root, "migrations/192_pms_forms_master.sql"), "utf8");
const fixtureSql = await fs.readFile(path.join(root, "server/modules/forms-master/__tests__/fixtures/forms-master-base.sql"), "utf8");
async function step(name: string, work: () => Promise<void> | void) { await work(); stats.push(name); console.log(`PASS ${name}`); }
async function fixture(label: string, migrated = true) {
  const schema = `forms_master_fixture_${label}_${randomUUID().replace(/-/g, "")}`;
  schemaNames.push(schema);
  await nativePool.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, options: `-c search_path=${schema}` });
  const context = { tuid: schema, pool, db: drizzle(pool) };
  contexts.push(context);
  await pool.query(fixtureSql);
  if (migrated) await pool.query(sqlFile);
  return context;
}
const inFixture = <T>(ctx: TenantContext, work: () => Promise<T>) => tenantStorage.run(ctx, work);
async function expectRejected(work: () => Promise<unknown>, pattern?: RegExp) {
  await assert.rejects(work, pattern);
}
async function scalar(ctx: TenantContext, query: string, values: unknown[] = []) {
  return (await ctx.pool.query(query, values)).rows[0];
}
async function snapshot(ctx: TenantContext) {
  const tables = ["pms_form_groups", "pms_form_categories", "pms_forms_master"];
  return Promise.all(tables.map(async table => (await ctx.pool.query(`SELECT to_jsonb(t) - 'id' - 'created_at' - 'updated_at' AS row FROM "${table}" t ORDER BY seed_key`)).rows));
}
let apiServer: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
try {
  await initStorage();
  const shore = await fixture("shore"), ship = await fixture("ship"), empty = await fixture("unmigrated", false);
  await step("Tracked migration on empty fixture; tracked rerun and two direct SQL reruns preserve data", async () => {
    const sandbox = path.join(root, "generated-artifacts/forms-master-migration-fixture");
    await fs.mkdir(path.join(sandbox, "migrations"), { recursive: true });
    await fs.writeFile(path.join(sandbox, "migrations/192_pms_forms_master.sql"), sqlFile);
    process.chdir(sandbox);
    try {
      const first = await runDrizzleMigrations(empty.pool);
      const second = await runDrizzleMigrations(empty.pool);
      assert.equal(first.applied, 1); assert.equal(second.applied, 0); assert.equal(second.skipped, 1);
    } finally { process.chdir(root); }
    await empty.pool.query(sqlFile); await empty.pool.query(sqlFile);
    assert.equal((await scalar(empty, "SELECT count(*)::int AS n FROM form_definitions")).n, 1);
  });
  await step("Migration matches both native UUID and TEXT role-reference installations without converting existing role data", async () => {
    const textRole = await fixture("text_role", false);
    await textRole.pool.query(await fs.readFile(path.join(root,"server/modules/forms-master/__tests__/fixtures/forms-master-text-role.sql"),"utf8"));
    await textRole.pool.query(sqlFile); await textRole.pool.query(sqlFile);
    for (const ctx of [shore,textRole]) {
      const row = await scalar(ctx,`SELECT
        (SELECT atttypid FROM pg_attribute WHERE attrelid='pms_forms_master'::regclass AND attname='approver_role_ruid') child,
        (SELECT atttypid FROM pg_attribute WHERE attrelid='admn_role_master'::regclass AND attname='ruid') parent`);
      assert.equal(row.child,row.parent);
    }
  });
  await step("Tenant startup lifecycle migrates and automatically seeds new tenant contexts before use, with system attribution and tenant-correct sync identity",async()=>{
    const shoreTenant=await fixture("tenant_startup_shore",false);
    const shipTenant=await fixture("tenant_startup_ship",false);
    await shoreTenant.pool.query("UPDATE sync_settings SET setting_value='SHORE-TENANT-STARTUP' WHERE setting_key='instance_id'");
    await shipTenant.pool.query("UPDATE sync_settings SET setting_value='SHIP-TENANT-STARTUP' WHERE setting_key='instance_id'");
    const sandbox=path.join(root,"generated-artifacts/forms-master-migration-fixture");
    const boot=(context:TenantContext)=>new Promise<Awaited<ReturnType<typeof initializePmsFormsMasterTenant>>>((resolve,reject)=>{
      // First access can inherit a real request. Seeds must still be SYSTEM.
      requestContextMiddleware({user:{id:1,userUuid:actor,fullName:"Office startup caller",userType:"Office",forwardedRole:"Fixture Office"}} as any,{} as any,()=>{
        initializePmsFormsMasterTenant(context,async()=>{
          assert.equal(tenantStorage.getStore()?.tuid,context.tuid);
          await runDrizzleMigrations(context.pool);
        }).then(resolve,reject);
      });
    });
    try {
      process.chdir(sandbox);
      const first=await boot(shoreTenant), ship=await boot(shipTenant);
      for(const result of [first,ship]) {
        assert.deepEqual(result.groups,{inserted:7,skipped:0});
        assert.deepEqual(result.categories,{inserted:57,skipped:0});
        assert.deepEqual(result.forms,{inserted:64,skipped:0});
      }
      for(const context of [shoreTenant,shipTenant]) {
        assert.equal((await scalar(context,"SELECT count(*)::int n FROM audit_log")).n,128);
        assert.equal((await scalar(context,"SELECT count(*)::int n FROM audit_log WHERE user_id <> 'system'")).n,0);
      }
      const outbound=(await shoreTenant.pool.query("SELECT DISTINCT instance_id,changed_by_user_id FROM sync_field_log")).rows;
      assert.deepEqual(outbound,[{instance_id:"SHORE-TENANT-STARTUP",changed_by_user_id:"system"}]);
      assert.equal((await scalar(shipTenant,"SELECT count(*)::int n FROM sync_field_log")).n,0);
      const before=(await shoreTenant.pool.query("UPDATE pms_forms_master SET form_name='Office preserved tenant default',is_deleted=true WHERE seed_key='FM-DEF-001' RETURNING updated_at::text")).rows[0];
      const repeat=await boot(shoreTenant);
      assert.deepEqual(repeat.forms,{inserted:0,skipped:64});
      const after=await scalar(shoreTenant,"SELECT form_name,is_deleted,updated_at::text FROM pms_forms_master WHERE seed_key='FM-DEF-001'");
      assert.equal(after.form_name,"Office preserved tenant default"); assert.equal(after.is_deleted,true);
      assert.equal(after.updated_at,before.updated_at);
      assert.equal((await scalar(shoreTenant,"SELECT count(*)::int n FROM audit_log")).n,128);
      const conflict=await fixture("tenant_startup_conflict",false);
      await expectRejected(()=>initializePmsFormsMasterTenant(conflict,async()=>{
        await runDrizzleMigrations(conflict.pool);
        await conflict.pool.query("INSERT INTO pms_form_groups(fguuid,group_code,group_name) VALUES ($1,'A','Custom conflicting tenant group')",[randomUUID()]);
      }),/seed conflicts/);
      assert.equal((await scalar(conflict,"SELECT count(*)::int n FROM pms_forms_master")).n,0);
    } finally { process.chdir(root); }
  });
  await step("Fresh deterministic seeds 7/57/64, ordered totals and exact guidance on two independent fixtures", async () => {
    const a = await inFixture(shore, () => repo.seedDefaults());
    await ship.pool.query("UPDATE sync_settings SET setting_value='SHIP-FIXTURE' WHERE setting_key='instance_id'");
    const b = await inFixture(ship, () => repo.seedDefaults());
    assert.deepEqual([a.groups.inserted, a.categories.inserted, a.forms.inserted], [7, 57, 64]);
    assert.deepEqual([b.groups.inserted, b.categories.inserted, b.forms.inserted], [7, 57, 64]);
    assert.deepEqual(await snapshot(shore), await snapshot(ship));
    assert.equal((await scalar(ship, "SELECT count(*)::int n FROM sync_field_log")).n, 0);
    assert.equal((await scalar(shore, "SELECT count(*)::int n FROM audit_log")).n, 128);
    const counts = (await shore.pool.query(`SELECT g.group_code, count(DISTINCT c.fcuuid)::int categories, count(f.fmuuid)::int forms
      FROM pms_form_groups g JOIN pms_form_categories c ON c.group_uuid=g.fguuid JOIN pms_forms_master f ON f.category_uuid=c.fcuuid GROUP BY g.group_code ORDER BY g.group_code`)).rows;
    assert.deepEqual(counts.map(r => [r.categories,r.forms]), [[5,7],[8,8],[11,16],[10,10],[9,9],[9,9],[5,5]]);
    const seed = await scalar(shore, "SELECT * FROM pms_forms_master WHERE seed_key='FM-DEF-001'");
    assert.equal(seed.when_to_use, PMS_FORM_DEFAULTS[0].whenToUse);
    assert.equal(seed.form_id, "A01-001");
  });
  await inFixture(shore, async () => {
    const groups = await repo.listGroups(), cats = await repo.listCategories(groups[0].fguuid);
    const input = { scope: "fleet" as const, vesselId: null, groupUuid: groups[0].fguuid, categoryUuid: cats[0].fcuuid,
      formName: "Fixture form", companyFormName: "Reusable company name", woPreApproval: false, woPostApproval: false, approverRoleRuid: null };
    await step("Reseeding preserves edits/deletions/timestamps/custom labels; inserts zero and audits nothing", async () => {
      const form = (await repo.listRecords(formsMasterListInput.parse({}))).records[0];
      await service.saveRecord({ ...input, formName: "Edited default", companyFormName: "Edited company" }, actor, form.fmuuid);
      await repo.changeFormDeleted(form.fmuuid, true, actor);
      await repo.saveLabel("group", "Office-added label", actor);
      const before = await shore.pool.query("SELECT * FROM pms_forms_master ORDER BY fmuuid");
      const logs = await scalar(shore, "SELECT (SELECT count(*)::int FROM audit_log) a, (SELECT count(*)::int FROM sync_field_log) s");
      const rerun = await repo.seedDefaults();
      assert.deepEqual([rerun.groups.inserted, rerun.categories.inserted, rerun.forms.inserted], [0,0,0]);
      assert.deepEqual((await shore.pool.query("SELECT * FROM pms_forms_master ORDER BY fmuuid")).rows, before.rows);
      assert.deepEqual(await scalar(shore, "SELECT (SELECT count(*)::int FROM audit_log) a, (SELECT count(*)::int FROM sync_field_log) s"), logs);
    });
    await step("Allocation Z→AA, H after defaults; deleted/reordered labels and category numbers never reused", async () => {
      assert.equal(repo.nextGroupCode(["Z","A","G"]), "AA"); assert.equal(repo.nextGroupCode(["G","B","A"]), "H");
      const all = await repo.listGroups();
      const custom = all.find(r=>r.groupName === "Office-added label")!;
      assert.equal(custom.groupCode, "H");
      await repo.reorderLabels("group", all.map(r=>r.fguuid).reverse(), actor);
      await repo.changeLabelDeleted("group", custom.fguuid, true, actor);
      const next = await repo.saveLabel("group", "Next allocation", actor);
      assert.ok("groupCode" in next && next.groupCode === "I");
      const one = await repo.saveLabel("category", "Custom Category", actor, undefined, groups[0].fguuid);
      assert.ok("categoryNo" in one && one.categoryNo === 6);
      if (!("fcuuid" in one)) throw new Error("Expected Category");
      await repo.changeLabelDeleted("category", one.fcuuid, true, actor);
      const two = await repo.saveLabel("category", "Next Category", actor, undefined, groups[0].fguuid);
      assert.ok("categoryNo" in two && two.categoryNo === 7);
    });
    await step("Concurrent creates, shared fleet/VES series, moved and deleted forms reserve historical suffixes", async () => {
      await shore.pool.query("INSERT INTO vessels(id,vuuid,code,name) VALUES ('fixture-vessel',$1,'fixture-vessel','Fixture vessel')", [vesselUuid]);
      const [a,b] = await Promise.all([
        service.saveRecord({...input, formName:"Concurrent fleet"},actor),
        service.saveRecord({...input, formName:"Concurrent vessel",scope:"vessel",vesselId:vesselUuid},actor),
      ]);
      assert.notEqual(a.formId.replace("VES-",""), b.formId.replace("VES-",""));
      assert.match(b.formId,/^VES-A01-\d{3}$/);
      await repo.changeFormDeleted(a.fmuuid,true,actor);
      const moved = await service.saveRecord({...input, scope:"vessel",vesselId:vesselUuid,formName:"Moved form",groupUuid:groups[1].fguuid,categoryUuid:(await repo.listCategories(groups[1].fguuid))[0].fcuuid},actor,b.fmuuid);
      assert.equal(moved.formId,b.formId);
      const next = await service.saveRecord({...input,formName:"After move"},actor);
      assert.ok(Number(next.formId.split("-").at(-1)) > Math.max(Number(a.formId.split("-").at(-1)),Number(b.formId.split("-").at(-1))));
      assert.equal(repo.nextFormId("AA",101,["AA101-999","VES-AA101-1000","BA101-9999"],true),"VES-AA101-1001");
      await expectRejected(()=> service.saveRecord({...input,scope:"fleet",formName:"Illegal scope"},actor,b.fmuuid), /Scope cannot change/);
    });
    await step("Validation, normalized whitespace DB uniqueness, protected metadata and nonunique company names", async () => {
      assert.equal(normalizeFormName("\u00a0Name\u00a0"),"\u00a0name\u00a0");
      assert.equal(formMasterInput.parse({...input,formName:"\u00a0Name\u00a0"}).formName,"\u00a0Name\u00a0");
      for (const value of [{...input,formName:""}, {...input,formName:"x".repeat(201)}, {...input,formId:"A01-999"}, {...input,isDefault:true},
        {...input,scope:"vessel"}, {...input,approverRoleRuid:"not-a-uuid"}, {...input,whenToUse:"edited"}])
        assert.equal(formMasterInput.safeParse(value).success,false);
      await service.saveRecord({...input,formName:"Whitespace Duplicate"},actor);
      for (const ws of ["  ","\t","\n","\r","\f","\v"]) {
        const name = ` \tWHITESPACE${ws}duplicate\t `;
        assert.equal(normalizeFormName(name),"whitespace duplicate");
        await expectRejected(()=> service.saveRecord({...input,formName:name},actor),/already in use/);
      }
      await service.saveRecord({...input,formName:"Company duplicate allowed"},actor);
      const foreignCategory = (await repo.listCategories(groups[1].fguuid))[0].fcuuid;
      await expectRejected(()=> service.saveRecord({...input,formName:"Wrong parent",categoryUuid:foreignCategory},actor),/belonging/);
      await expectRejected(()=> service.saveRecord({...input,formName:"Unknown vessel",scope:"vessel",vesselId:randomUUID()},actor),/active vessel/);
      await expectRejected(()=> service.saveRecord({...input,formName:"Unknown role",approverRoleRuid:randomUUID()},actor),/active Approver/);
      const a = await service.saveRecord({...input,formName:"Restore collision"},actor);
      await repo.changeFormDeleted(a.fmuuid,true,actor);
      await service.saveRecord({...input,formName:"Restore collision"},actor);
      await expectRejected(()=>service.deleteOrRestoreRecord(a.fmuuid,false,actor),/already in use/);
    });
    await step("All-column sorting, bounded pagination, truthful totals and server-side search/filter combinations", async () => {
      for (const sort of ["formId","scope","group","category","formName","companyFormName","woPreApproval","woPostApproval","approver","actions"]) {
        for (const direction of ["asc","desc"]) {
          const result = await service.listForms({sort,direction,page:1,pageSize:5});
          assert.equal(result.records.length,5); assert.ok(result.total>=64);
        }
      }
      const page1 = await service.listForms({page:1,pageSize:5});
      const page2 = await service.listForms({page:2,pageSize:5});
      assert.equal(page1.total,page2.total);
      assert.equal(page2.records.some(row=>page1.records.some(first=>first.fmuuid===row.fmuuid)),false);
      const filtered = await service.listForms({groupUuid:input.groupUuid,categoryUuid:input.categoryUuid,scope:"fleet",pre:"false",post:"false"});
      assert.ok(filtered.records.every(row=>row.groupUuid===input.groupUuid && row.categoryUuid===input.categoryUuid && row.scope==="fleet" && !row.woPreApproval && !row.woPostApproval));
      const all = await service.listForms({showDeleted:"true",pageSize:100});
      assert.equal(all.total,(await scalar(shore,"SELECT count(*)::int n FROM pms_forms_master")).n);
      assert.ok((await service.listForms({search:"Edited company",showDeleted:"true"})).records.some(row=>row.formName==="Edited default"));
      await expectRejected(async()=>service.listForms({sort:"unsafe; DROP TABLE",pageSize:10000}));
    });
    await step("Deletion usage counts, parent availability, category reorder isolation and no physical removal", async () => {
      await expectRejected(()=>repo.changeLabelDeleted("group",groups[0].fguuid,true,actor),/active Categories.*active Forms/);
      await expectRejected(()=>repo.changeLabelDeleted("category",cats[0].fcuuid,true,actor),/active Forms/);
      await expectRejected(()=>repo.reorderLabels("category",[cats[0].fcuuid,cats[0].fcuuid],actor,groups[0].fguuid),/exactly once/);
      const foreignCategory = (await repo.listCategories(groups[1].fguuid))[0].fcuuid;
      await expectRejected(()=>repo.reorderLabels("category",[foreignCategory],actor,groups[0].fguuid),/exactly once/);
      await repo.reorderLabels("category",cats.map(r=>r.fcuuid).concat((await repo.listCategories(groups[0].fguuid)).filter(r=>!cats.some(c=>c.fcuuid===r.fcuuid)).map(r=>r.fcuuid)).reverse(),actor,groups[0].fguuid);
      const cat = await repo.saveLabel("category","Empty restored parent test",actor,undefined,groups[0].fguuid);
      if (!("fcuuid" in cat)) throw new Error("Expected category");
      const form = await service.saveRecord({...input,categoryUuid:cat.fcuuid,formName:"Parent restore test"},actor);
      await repo.changeFormDeleted(form.fmuuid,true,actor);
      await repo.changeLabelDeleted("category",cat.fcuuid,true,actor);
      await expectRejected(()=>repo.changeFormDeleted(form.fmuuid,false,actor),/active Category/);
      assert.equal((await scalar(shore,"SELECT count(*)::int n FROM pms_forms_master WHERE fmuuid=$1",[form.fmuuid])).n,1);
    });
    await step("Concurrent hierarchy deletion and child creation cannot leave active children below deleted parents", async () => {
      const category = await repo.saveLabel("category","Hierarchy race",actor,undefined,input.groupUuid);
      if (!("fcuuid" in category)) throw new Error("Expected category");
      const results = await Promise.allSettled([
        repo.changeLabelDeleted("category",category.fcuuid,true,actor),
        service.saveRecord({...input,categoryUuid:category.fcuuid,formName:"Hierarchy race form"},actor),
      ]);
      assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
      assert.equal((await scalar(shore,`SELECT count(*)::int n FROM pms_forms_master f
        JOIN pms_form_categories c ON c.fcuuid=f.category_uuid JOIN pms_form_groups g ON g.fguuid=f.group_uuid
        WHERE NOT f.is_deleted AND (c.is_deleted OR g.is_deleted)`)).n,0);
      const group = await repo.saveLabel("group","Hierarchy group race",actor);
      if (!("fguuid" in group)) throw new Error("Expected group");
      const groupResults = await Promise.allSettled([
        repo.changeLabelDeleted("group",group.fguuid,true,actor),
        repo.saveLabel("category","Hierarchy category race",actor,undefined,group.fguuid),
      ]);
      assert.equal(groupResults.filter(result=>result.status==="fulfilled").length,1);
      assert.equal((await scalar(shore,`SELECT count(*)::int n FROM pms_form_categories c
        JOIN pms_form_groups g ON g.fguuid=c.group_uuid WHERE NOT c.is_deleted AND g.is_deleted`)).n,0);
    });
    await step("Audit and outbound-log failures roll back business rows; real actor and before/after captured", async () => {
      for (const name of ["audit","sync"]) {
        await shore.pool.query("UPDATE fixture_faults SET enabled=true WHERE name=$1",[name]);
        try { await expectRejected(()=>service.saveRecord({...input,formName:`Failure ${name}`},actor)); }
        finally { await shore.pool.query("UPDATE fixture_faults SET enabled=false WHERE name=$1",[name]); }
        assert.equal((await scalar(shore,"SELECT count(*)::int n FROM pms_forms_master WHERE form_name=$1",[`Failure ${name}`])).n,0);
      }
      const row = await scalar(shore,"SELECT * FROM audit_log WHERE user_id=$1 ORDER BY id DESC LIMIT 1",[actor]);
      assert.ok(row.payload.after); assert.ok(row.action_type);
      const actions = (await shore.pool.query("SELECT DISTINCT action_type FROM audit_log")).rows.map(r=>r.action_type);
      for (const action of ["create","update","delete","reorder"]) assert.ok(actions.includes(action));
    });
  });
  await step("Seed preflight reports conflicting custom identity and commits no defaults", async () => {
    await empty.pool.query("INSERT INTO pms_form_groups(fguuid,group_code,group_name) VALUES ($1,'A','Custom occupied A')",[randomUUID()]);
    await inFixture(empty,()=>expectRejected(()=>repo.seedDefaults(),/seed conflicts/));
    assert.equal((await scalar(empty,"SELECT count(*)::int n FROM pms_form_categories")).n,0);
    assert.equal((await scalar(empty,"SELECT count(*)::int n FROM pms_forms_master")).n,0);
  });
  await step("Direct API authorization: all mutations deny ship, vessel, missing/mock/unconfigured/admin-no-permission identities", async () => {
    await shore.pool.query(`INSERT INTO admn_role_master(id,ruid,assigned_role,roletype,is_active) VALUES
      (1,$1,'Fixture Office','Office',true),(2,$2,'Sail Admin','Office',true),(3,$3,'PMS Admin','Office',true)`,[roleUuid,randomUUID(),randomUUID()]);
    await shore.pool.query(`INSERT INTO adm_menumaster_ac(id,muid,name,display_name,is_active) VALUES (1,$1,'admin-masters','Admin Masters',true)`,[menuUuid]);
    const app = express(); app.use(express.json());
    app.use((_req,_res,next)=>tenantStorage.run(shore,next));
    app.use((req,_res,next)=>{
      // Model the existing tenant gateway with a DIFFERENT signature key.
      // Single-tenant tests exercise Forms Master's own real JWT verification.
      if (fixtureTenantMode) {
        try {
          const token = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
          if (token) {
            const claims = jwt.verify(token,fixtureTenantJwtKey,{algorithms:["HS256"]});
            if (typeof claims!=="string") (req as any).verifiedUser=readVerifiedUser(claims);
          }
        } catch { /* Leave the request unverified; Forms Master must refuse it. */ }
      }
      next();
    });
    app.use(mockAuthMiddleware); app.use(requestContextMiddleware);
    app.use("/forms",formsMasterRouter);
    apiServer = app.listen(0,"127.0.0.1"); await once(apiServer,"listening");
    const address = apiServer.address(); if (!address || typeof address === "string") throw new Error("API not listening");
    const url = `http://127.0.0.1:${address.port}/forms`;
    const headers = (role = "Fixture Office", type = "Office") => ({
      "Content-Type":"application/json","x-user-id":actor,"x-user-role":role,"x-user-type":type,"x-user-name":"Fixture Office",
      "Authorization":`Bearer ${jwt.sign({id:actor,role,userType:type},fixtureTenantMode?fixtureTenantJwtKey:fixtureJwtKey,{algorithm:"HS256",expiresIn:"5m"})}`,
    });
    const id = randomUUID();
    const mutations: [string,string][] = [
      ["POST","records"],["PUT",`records/${id}`],["DELETE",`records/${id}`],["POST",`records/${id}/restore`],
      ...["groups","categories"].flatMap(p=> [["POST",p],["PUT",`${p}/${id}`],["DELETE",`${p}/${id}`],["POST",`${p}/${id}/restore`],["PUT",`${p}/order`]] as [string,string][]),
    ];
    for (const h of [{},headers("Fixture Office","Ship"),headers("Missing role"),headers("Sail Admin"),headers("PMS Admin"),headers(),
      {...headers(),"x-user-id":createDefaultDevelopmentUser().userUuid!}]) {
      for (const [method,route] of mutations) {
        const response = await fetch(`${url}/${route}`,{method,headers:h,body: method === "DELETE" ? undefined : "{}"});
        assert.ok([401,403].includes(response.status),`${method} ${route}: ${response.status}`);
      }
    }
    await shore.pool.query("INSERT INTO adm_role_menu_access(role_ruid,menu_muid,can_view,can_create,can_edit,can_delete) VALUES ($1,$2,true,true,true,true)",[roleUuid,menuUuid]);
    await shore.pool.query("UPDATE sync_settings SET setting_value='SHIP-FIXTURE' WHERE setting_key='instance_id'");
    for (const [method,route] of mutations) assert.equal((await fetch(`${url}/${route}`,{method,headers:headers(),body:method==="DELETE"?undefined:"{}"})).status,403);
    await shore.pool.query("UPDATE sync_settings SET setting_value='SHORE-FORMS-FIXTURE' WHERE setting_key='instance_id'");
    assert.equal((await fetch(`${url}/groups`,{headers:headers()})).status,200);
    assert.equal((await fetch(`${url}/groups`)).status,401);
    const defaultActor = createDefaultDevelopmentUser().userUuid!;
    for (const [method,route] of mutations) {
      const response = await fetch(`${url}/${route}`,{method,headers:{...headers(),"x-user-id":defaultActor},body:method==="DELETE"?undefined:"{}"});
      assert.equal(response.status,401,`Development fallback ${method} ${route} must require a verified login`);
    }
    const knownActorRequest = {user:{userUuid:defaultActor},rbac:{source:"forwarded",role:"Fixture Office",userType:"Office"},
      get:(name:string)=>name==="x-user-id"?defaultActor:undefined} as any;
    assert.throws(()=>service.requireCatalogueIdentity(knownActorRequest),/identified user/);
    assert.equal(service.requireCatalogueIdentity({...knownActorRequest,verifiedUser:{userId:defaultActor,role:"Fixture Office",userType:"Office",missing:[]}}),defaultActor);
    const response = await fetch(`${url}/groups`,{method:"POST",headers:headers(),body:JSON.stringify({groupName:"API created group"})});
    assert.equal(response.status,201);
    const group = await response.json();
    assert.equal((await fetch(`${url}/groups/${group.fguuid}`,{method:"DELETE",headers:headers()})).status,200);
    await shore.pool.query("UPDATE adm_role_menu_access SET can_edit=false WHERE role_ruid=$1",[roleUuid]);
    assert.equal((await fetch(`${url}/groups/${group.fguuid}/restore`,{method:"POST",headers:headers()})).status,403);
    await shore.pool.query("UPDATE adm_role_menu_access SET can_edit=true WHERE role_ruid=$1",[roleUuid]);
    assert.equal((await fetch(`${url}/groups/${group.fguuid}/restore`,{method:"POST",headers:headers()})).status,200);
    const audit = await scalar(shore,"SELECT * FROM audit_log WHERE entity_id=$1 ORDER BY id DESC LIMIT 1",[group.fguuid]);
    assert.equal(audit.user_id,actor); assert.equal(audit.action_type,"restore");
    await step("Verified login is mandatory: forged UUID/role/type and token mismatches are denied in single-tenant and multi-tenant modes",async()=>{
      Object.defineProperty(tenantConnectionManager,"isMultiTenantEnabled",{configurable:true,get:()=>fixtureTenantMode});
      try {
        for (const multi of [false,true]) {
          fixtureTenantMode=multi;
          const good=headers();
          const {Authorization: _token,...unsigned}=good;
          const key=multi?fixtureTenantJwtKey:fixtureJwtKey;
          const attacks: Record<string,string>[]=[
            unsigned,
            {...unsigned,"x-user-id":randomUUID()},
            {...unsigned,"x-user-role":"Sail Admin"},
            {...good,"x-user-id":randomUUID()},
            {...good,"x-user-role":"Sail Admin"},
            {...good,"x-user-type":"Ship"},
            {...good,Authorization:`Bearer ${jwt.sign({id:actor,role:"Vessel User",userType:"Ship"},key,{algorithm:"HS256"})}`},
            {...good,Authorization:`Bearer ${jwt.sign({id:actor,role:"Fixture Office"},key,{algorithm:"HS256"})}`},
            {...good,Authorization:`Bearer ${jwt.sign({id:actor,role:"Fixture Office",userType:"Office"},key,{algorithm:"HS256",expiresIn:-1})}`},
            {...good,Authorization:`Bearer ${jwt.sign({id:actor,role:"Fixture Office",userType:"Office"},"untrusted-fixture-key",{algorithm:"HS256"})}`},
            {...good,Authorization:"Bearer not-a-token"},
          ];
          // A valid single-tenant token may NEVER substitute for tenant verification.
          if(multi) attacks.push({...good,Authorization:`Bearer ${jwt.sign({id:actor,role:"Fixture Office",userType:"Office"},fixtureJwtKey,{algorithm:"HS256"})}`});
          const before=(await scalar(shore,"SELECT count(*)::int n FROM audit_log")).n;
          for(const attack of attacks) {
            for(const [method,route] of mutations) {
              const denied=await fetch(`${url}/${route}`,{method,headers:attack,body:method==="DELETE"?undefined:"{}"});
              assert.equal(denied.status,401,`${multi?"multi":"single"} ${method} ${route}: forged identity must not authorize`);
            }
            assert.equal((await fetch(`${url}/groups`,{headers:attack})).status,401);
          }
          assert.equal((await scalar(shore,"SELECT count(*)::int n FROM audit_log")).n,before);
          assert.equal((await fetch(`${url}/groups`,{headers:good})).status,200);
          const shipRead=await fetch(`${url}/options`,{headers:headers("Fixture Office","Ship")});
          assert.equal(shipRead.status,200);
          assert.deepEqual((await shipRead.json()).capabilities,{create:false,edit:false,delete:false});
          const created=await fetch(`${url}/groups`,{method:"POST",headers:good,body:JSON.stringify({groupName:`Verified ${multi?"tenant":"single"} Office group`})});
          assert.equal(created.status,201);
          const row=await created.json();
          assert.equal((await scalar(shore,"SELECT user_id FROM audit_log WHERE entity_id=$1 ORDER BY id DESC LIMIT 1",[row.fguuid])).user_id,actor);
          assert.equal((await fetch(`${url}/groups/${row.fguuid}`,{method:"DELETE",headers:good})).status,200);
        }
      } finally {
        fixtureTenantMode=false;
        delete (tenantConnectionManager as any).isMultiTenantEnabled;
      }
    });
  });
  await step("Explicit sync order/config, preseeded replay, new parents/children, vessel FK failure stays an error, tombstones and restore converge", async () => {
    const order = getTablesByCategory("ONE_WAY_SHORE_TO_SHIP").map(t=>t.tableName);
    const tables = ["pms_form_groups","pms_form_categories","pms_forms_master"];
    assert.deepEqual(order.slice(-3),tables);
    assert.deepEqual(getSyncPhaseOrder()[0].slice(-3),tables);
    for (const table of tables) { assert.equal(SYNC_CONFIG[table].isGlobal,true); assert.equal(SYNC_CONFIG[table].vesselScopeColumn,null); assert.equal(formsMasterProvisioningWhere(table),""); }
    const before = await scalar(ship,"SELECT count(*)::int n FROM audit_log");
    // Missing reference is deliberately not silently acknowledged.
    for (const table of tables) {
      const rows = (await shore.pool.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
      const result = await inFixture(ship,()=>applyOneWayRows(table,rows));
      if (table !== "pms_forms_master") assert.deepEqual(result.errors,[]);
      else assert.ok(result.errors.some(e=>/foreign key|vessel/i.test(e.error)));
    }
    await ship.pool.query("INSERT INTO vessels(id,vuuid,code,name) VALUES ('fixture-vessel',$1,'fixture-vessel','Fixture vessel')",[vesselUuid]);
    for (const table of tables) {
      const rows = (await shore.pool.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
      const result = await inFixture(ship,()=>applyOneWayRows(table,rows));
      assert.deepEqual(result.errors,[]);
      const replay = await inFixture(ship,()=>applyOneWayRows(table,rows));
      assert.deepEqual(replay.errors,[]);
    }
    const compare = async (table:string,identity:string) => {
      const query = `SELECT to_jsonb(t) - 'id' - 'updated_at' - 'created_at' AS row FROM "${table}" t ORDER BY "${identity}"`;
      assert.deepEqual((await ship.pool.query(query)).rows,(await shore.pool.query(query)).rows);
    };
    await compare(tables[0],"fguuid"); await compare(tables[1],"fcuuid"); await compare(tables[2],"fmuuid");
    assert.equal((await scalar(ship,"SELECT count(*)::int n FROM audit_log")).n,before.n);
    // A receiver missing the migration reports an error, not successful delivery.
    const missing = await fixture("missing_receiver",false);
    const rows = (await shore.pool.query("SELECT * FROM pms_form_groups LIMIT 1")).rows;
    const result = await inFixture(missing,()=>applyOneWayRows("pms_form_groups",rows));
    assert.ok(result.errors.length>0); assert.equal(result.inserted,0); assert.equal(result.updated,0);
  });
  await step("Historic role snapshots and Forms Master full provisioning retain tombstones, UUIDs and receiver-local integer IDs", async () => {
    const referenceForm = await inFixture(shore,async()=>{
      const group = (await repo.listGroups()).find(row=>row.groupCode==="A")!;
      const category = (await repo.listCategories(group.fguuid))[0];
      return service.saveRecord({scope:"fleet",vesselId:null,groupUuid:group.fguuid,categoryUuid:category.fcuuid,
        formName:"Historic approver",companyFormName:"Historic company name",woPreApproval:true,woPostApproval:true,approverRoleRuid:roleUuid},actor);
    });
    await shore.pool.query("UPDATE admn_role_master SET is_active=false,is_deleted=true,assigned_role='Renamed retired role' WHERE ruid=$1",[roleUuid]);
    await inFixture(shore,async()=>{
      assert.equal((await repo.getRecord(referenceForm.fmuuid)).approverRoleLabel,"Fixture Office");
      assert.equal((await repo.lookupApproverRoles()).some(r=>r.ruid===roleUuid),false);
    });
    const names = ["vessels","admn_role_master","pms_form_groups","pms_form_categories","pms_forms_master"];
    const data = await Promise.all(names.map(async tableName=>({
      tableName,rows:(await shore.pool.query(`SELECT * FROM "${tableName}" ${formsMasterProvisioningWhere(tableName)} ORDER BY id`)).rows,
    })));
    const referenced = formsMasterReferencedRoles(data);
    assert.ok(referenced.has(roleUuid));
    const roleRows = data.find(batch=>batch.tableName==="admn_role_master")!.rows;
    assert.ok(roleRows.some(row=>row.ruid===roleUuid && row.is_deleted));
    const retired = await inFixture(ship,()=>applyOneWayRows("admn_role_master",roleRows,undefined,referenced));
    assert.deepEqual(retired.errors,[]);
    const formRows = data.find(batch=>batch.tableName==="pms_forms_master")!.rows;
    assert.deepEqual((await inFixture(ship,()=>applyOneWayRows("pms_forms_master",formRows))).errors,[]);
    const bundle: ProvisioningBundle = {
      manifest:{vesselId:vesselUuid,vesselName:"Fixture vessel",vesselCode:"fixture-vessel",generatedAt:new Date().toISOString(),generatedBy:actor,
        instanceId:"SHORE-FORMS-FIXTURE",version:"1.0",tables:data.map(batch=>({tableName:batch.tableName,rowCount:batch.rows.length,category:"Forms Master fixture"})),
        totalRows:data.reduce((n,batch)=>n+batch.rows.length,0)},
      data,
    };
    assert.equal((await verifyBundleExportIntegrity(shore.pool,vesselUuid,"fixture-vessel",bundle)).ok,true);
    // Preseeded receiver includes a different local-ID allocation range.
    const receiver = await fixture("provisioning");
    await receiver.pool.query("UPDATE sync_settings SET setting_value='SHIP-PROVISIONING-FIXTURE' WHERE setting_key='instance_id'");
    for (const table of ["pms_form_groups","pms_form_categories","pms_forms_master"])
      await receiver.pool.query("SELECT setval(pg_get_serial_sequence($1, 'id'), 1000, false)",[table]);
    await inFixture(receiver,()=>repo.seedDefaults());
    const formsBefore = await scalar(receiver,"SELECT count(*)::int n FROM pms_forms_master");
    assert.equal(formsBefore.n,64);
    const imported = await inFixture(receiver,()=>importProvisioningBundle(bundle));
    assert.equal(imported.success,true,JSON.stringify(imported.errors));
    const again = await inFixture(receiver,()=>importProvisioningBundle(bundle));
    assert.equal(again.success,true,JSON.stringify(again.errors));
    const deletedSource = await scalar(shore,"SELECT count(*)::int n FROM pms_forms_master WHERE is_deleted");
    assert.equal((await scalar(receiver,"SELECT count(*)::int n FROM pms_forms_master WHERE is_deleted")).n,deletedSource.n);
    assert.equal((await scalar(receiver,"SELECT approver_role_label FROM pms_forms_master WHERE fmuuid=$1",[referenceForm.fmuuid])).approver_role_label,"Fixture Office");
    assert.notEqual((await scalar(receiver,"SELECT id FROM pms_forms_master WHERE fmuuid=$1",[referenceForm.fmuuid])).id,
      (await scalar(shore,"SELECT id FROM pms_forms_master WHERE fmuuid=$1",[referenceForm.fmuuid])).id);
    assert.equal((await scalar(receiver,"SELECT count(*)::int n FROM audit_log")).n,128);
    const unmigrated = await fixture("provisioning_unmigrated",false);
    await expectRejected(()=>inFixture(unmigrated,()=>importProvisioningBundle(bundle)),/requires migration 192/);
  });
  console.log(`FORMS MASTER FIXTURE VERIFICATION: ${stats.length} groups passed. Pilot NOT used; these are isolated fixture results.`);
} finally {
  if (apiServer) await new Promise<void>((resolve,reject)=>apiServer!.close(e=>e?reject(e):resolve()));
  for (const ctx of contexts) await ctx.pool.end();
  for (const schema of schemaNames) await nativePool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await nativePool.end();
}
// Imported singleton pools have idle timers; normal process exit follows after cleanup.
