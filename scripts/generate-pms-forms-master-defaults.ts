/**
 * Build-time, manual source conversion only. Never imported by the application.
 * Regeneration is review-only: changing ordered seed identities requires a migration plan.
 */
import fs from "node:fs";
import XLSX from "xlsx";
const source = "attached_assets/SAIL_Shipboard_Maintenance_Forms_Register_Group_CategoryggH_1794199391804.xlsx";
const workbook = XLSX.readFile(source);
const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Forms Register"], { header: 1 });
const header = rows.findIndex(row => row[0] === "SL No");
const canonical = rows.slice(header + 1).filter(row => row[3] && row[3] !== "PMS Work Order / Job Card");
const other = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Sheet1, { header: 1 }).slice(1).filter(row => row[3]);
if (JSON.stringify(canonical.map(row => row.slice(1, 4))) !== JSON.stringify(other.map(row => row.slice(1, 4))))
  throw new Error("Workbook sheets disagree");
const groups = new Map<string, Map<string, number>>();
const data = canonical.map((row, i) => {
  const [groupName, categoryName, formName, whenToUse, responsible, typicalJobs, suggestedApprover] = row.slice(1).map(v => String(v ?? ""));
  if (!groups.has(groupName)) groups.set(groupName, new Map());
  const categories = groups.get(groupName)!;
  if (!categories.has(categoryName)) categories.set(categoryName, categories.size + 1);
  return { seedKey: `FM-DEF-${String(i + 1).padStart(3, "0")}`, groupCode: String.fromCharCode(65 + [...groups.keys()].indexOf(groupName)),
    groupName, categoryNo: categories.get(categoryName)!, categoryName, formName, whenToUse, responsible, typicalJobs, suggestedApprover };
});
const counts = [...groups].map(([name, cats]) => [cats.size, data.filter(row => row.groupName === name).length]);
if (data.length !== 64 || groups.size !== 7 || JSON.stringify(counts) !== JSON.stringify([[5,7],[8,8],[11,16],[10,10],[9,9],[9,9],[5,5]]))
  throw new Error(`Register totals differ: ${JSON.stringify(counts)}`);
const target = "server/modules/forms-master/defaults/pmsFormsMasterSeedData.ts";
fs.mkdirSync("server/modules/forms-master/defaults", { recursive: true });
fs.writeFileSync(target, `// Generated from Forms Register; excludes PMS Work Order / Job Card.\n// Cross-checked ordered Group/Category/Form data against Sheet1. DO NOT reorder identities.\nexport const PMS_FORMS_NAMESPACE = "c9030cc3-3842-54f9-8626-1af86ca72675";\nexport interface PmsFormDefault { seedKey: string; groupCode: string; groupName: string; categoryNo: number; categoryName: string; formName: string; whenToUse: string; responsible: string; typicalJobs: string; suggestedApprover: string }\nexport const PMS_FORM_DEFAULTS: readonly PmsFormDefault[] = ${JSON.stringify(data, null, 2)};\n`);
console.log(JSON.stringify({ forms: data.length, groups: groups.size, categories: counts.reduce((n, c) => n + c[0], 0), counts, crossCheck: "identical" }));
