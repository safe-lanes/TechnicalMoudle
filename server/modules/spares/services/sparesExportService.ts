import ExcelJS from "exceljs";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../../db";
import { SPARES_TEMPLATE_FIELDS } from "@shared/sparesTemplateFields";
import { componentSpareValues } from "@shared/sparesExportValues";
import type { SparePageQuery } from "@shared/sparesPagination";
import { camel, criteria, from, ordering, scope, displayHistoryDay } from "../repositories/sparesPagingRepository";

/** File-backed streaming writer: validate the entire snapshot before sending any
 * bytes to the user. Both SQL reads and writer buffers stay bounded. */
export async function writeSpareExport(filename: string, vesselId: string, q: SparePageQuery, type: "unique" | "component" | "history") {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename, useStyles: true });
  let excluded = 0;
  let rowCount = 0;
  const db = await getDb();
  try {
    await db.transaction(async tx => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
      const batches = async (query: SQL, consume: (row: any) => void) => {
        for (let offset = 0; ; offset += 200) {
          const result = await tx.execute(sql`${query} LIMIT 200 OFFSET ${offset}`);
          result.rows.forEach(consume);
          if (result.rows.length < 200) break;
        }
      };
      if (type === "history") {
        const sheet = workbook.addWorksheet("Spares History");
        sheet.addRow(["Date", "Part Code", "Part Name", "Component", "Part Number", "Event", "Qty Change", "ROB After", "Reference"]).commit();
        await batches(sql`SELECT s.*,p.part_number,to_char(${displayHistoryDay(q)},'DD-Mon-YYYY') AS display_date
          FROM ${from(q)} WHERE ${criteria(vesselId, q)} ORDER BY ${ordering(q)}`, row => {
          sheet.addRow([row.display_date || "-", row.part_code, row.part_name, row.component_name,
            row.part_number || "-", row.event_type, row.qty_change, row.rob_after, row.reference || "-"]).commit();
          rowCount++;
        });
        sheet.commit();
        return;
      }
      const categories = await tx.execute(sql`SELECT list_key, list_value FROM master_lists
        WHERE list_type='spareCategory' AND is_active=true AND is_deleted IS NOT TRUE`);
      const spareCategoryLabels = Object.fromEntries(
        categories.rows.filter(item => item.list_key && item.list_value)
          .map(item => [String(item.list_key), String(item.list_value)]),
      );
      const sheet = workbook.addWorksheet("Spares");
      const categoryInTemplate = SPARES_TEMPLATE_FIELDS.some(field => field.key === "spareCategory");
      const optimumInTemplate = SPARES_TEMPLATE_FIELDS.some(field => field.key === "optimumQty");
      const markerColumn = Math.max(29, SPARES_TEMPLATE_FIELDS.length + 1);
      const spacerColumns = Math.max(0, markerColumn - SPARES_TEMPLATE_FIELDS.length);
      sheet.columns = [
        ...SPARES_TEMPLATE_FIELDS.map(field => ({ header: field.header, width: field.width })),
        ...Array.from({ length: spacerColumns }, () => ({ header: "", width: 3 })),
        ...(!categoryInTemplate ? [{ header: "Spare Category", width: 20 }] : []),
        ...(!optimumInTemplate ? [{ header: "Optimum Qty", width: 14 }] : []),
      ];
      sheet.getCell(1, markerColumn).value = "_TEMPLATE_VERSION_2.0.0";
      sheet.getRow(1).font = { bold: true };
      const reference = workbook.addWorksheet("Components");
      reference.columns = [
        { header: "Component Code", width: 20 }, { header: "Component Name", width: 40 },
        { header: "Category", width: 35 }, { header: "Fleet Equipment Code", width: 20 },
        { header: "Fleet Equipment Name", width: 30 },
      ];
      reference.getRow(1).font = { bold: true };
      const lists = workbook.addWorksheet("Lists");
      lists.columns = [{ header: "UOM", width: 15 }, { header: "Yes/No", width: 15 }];
      lists.getRow(1).font = { bold: true };
      ["PCS", "SET", "LTR", "KG", "M", "BOX", "ROLL", "PACK", "KIT", "OTHER"].forEach((v, i) => { lists.getCell(i + 2, 1).value = v; });
      lists.getCell("B2").value = "Yes"; lists.getCell("B3").value = "No";
      const componentEligible = sql`c.data_scope IS DISTINCT FROM 'fleet'
        AND c.is_deleted IS DISTINCT FROM TRUE ${q.activeOnly === "true" ? sql`AND c.is_active IS DISTINCT FROM FALSE` : sql``}`;
      await batches(sql`SELECT c.* FROM components c WHERE ${scope(vesselId, q, "c")} AND ${componentEligible}
        AND COALESCE(c.component_code,'')<>'' AND COALESCE(c.name,'')<>'' ORDER BY c.vessel_id,c.id`, row => {
        reference.addRow([row.component_code ?? "", row.name ?? "", row.category ?? "", row.fleet_equipment_code ?? "", row.fleet_equipment_name ?? ""]).commit();
      });
      const write = (s: any, c: any) => {
        const row = sheet.addRow(componentSpareValues(s, c, spareCategoryLabels));
        for (const key of ["uom", "criticality", "isActive", "ihm", "isRotationItem"]) {
          const column = SPARES_TEMPLATE_FIELDS.findIndex(field => field.key === key) + 1;
          if (column < 1) continue;
          row.getCell(column).dataValidation = {
            type: "list", allowBlank: true, formulae: [key === "uom" ? "=Lists!$A$2:$A$11" : "=Lists!$B$2:$B$3"],
          };
        }
        row.commit();
        rowCount++;
      };
      if (type === "unique") {
        const inventory = { ...q, kind: "inventory" as const, search: "", criticality: "" as const, rotation: "" as const,
          stockStatus: "" as const, componentId: "", filters: "{}", sort: "[]" };
        await batches(sql`SELECT s.*,to_jsonb(c) AS primary_component FROM
          (SELECT DISTINCT ON(s.vessel_id,s.part_code) s.* FROM spares s WHERE ${criteria(vesselId, inventory)}
            ORDER BY s.vessel_id,s.part_code,s.id) s
          LEFT JOIN LATERAL (SELECT c.* FROM components c WHERE c.vessel_id=s.vessel_id AND ${componentEligible}
            AND ((COALESCE(s.component_id,'')<>'' AND (c.cuuid=s.component_id OR c.id::text=s.component_id))
              OR (COALESCE(s.component_id,'')='' AND c.component_code=s.component_code AND COALESCE(c.name,'')<>''
                AND (SELECT count(*) FROM components c WHERE c.vessel_id=s.vessel_id AND c.component_code=s.component_code AND COALESCE(c.name,'')<>'' AND ${componentEligible})=1))
            LIMIT 1) c ON TRUE ORDER BY s.vessel_id,s.part_code,s.id`, raw => {
          const s = camel(raw), c = raw.primary_component ? camel(raw.primary_component) : {};
          if (typeof s.partCode !== "string" || !s.partCode.trim()) throw new Error("A spare has no part code. Export was not downloaded.");
          const primary = !s.componentCode || s.componentCode === c.componentCode ? c : {};
          write(s, {
            componentCode: s.componentCode || primary.componentCode || "", name: s.componentName || primary.name || "",
            fleetEquipmentCode: s.fleetEquipmentCode || primary.fleetEquipmentCode || "",
            fleetEquipmentName: s.fleetEquipmentName || ((!s.fleetEquipmentCode || s.fleetEquipmentCode === primary.fleetEquipmentCode) ? primary.fleetEquipmentName : "") || "",
          });
        });
      } else {
        const duplicate = await tx.execute(sql`SELECT 1 FROM spare_component_links cl
          JOIN spares s ON (cl.spare_uuid IS NOT NULL AND s.suuid=cl.spare_uuid) OR (cl.spare_uuid IS NULL AND s.id=cl.spare_id)
          JOIN components c ON c.cuuid=cl.component_id AND c.vessel_id=cl.vessel_id
          WHERE ${scope(vesselId, q, "cl")} AND cl.is_deleted IS DISTINCT FROM TRUE
            AND s.vessel_id=cl.vessel_id AND s.deleted=false AND s.is_deleted IS DISTINCT FROM TRUE
            AND ${componentEligible} ${q.activeOnly === "true" ? sql`AND s.is_active IS DISTINCT FROM FALSE` : sql``}
          GROUP BY cl.vessel_id,COALESCE(cl.spare_uuid,cl.spare_id::text),cl.component_id HAVING count(*)>1 LIMIT 1`);
        if (duplicate.rows.length) throw new Error("Duplicate component linkage. Export was not downloaded.");
        await batches(sql`SELECT cl.*,to_jsonb(s) AS spare,to_jsonb(c) AS component,to_jsonb(n) AS numeric_spare FROM spare_component_links cl
          LEFT JOIN spares s ON (cl.spare_uuid IS NOT NULL AND s.suuid=cl.spare_uuid) OR (cl.spare_uuid IS NULL AND s.id=cl.spare_id)
          LEFT JOIN spares n ON n.id=cl.spare_id
          LEFT JOIN components c ON c.cuuid=cl.component_id AND c.vessel_id=cl.vessel_id
          WHERE ${scope(vesselId, q, "cl")} AND cl.is_deleted IS DISTINCT FROM TRUE ORDER BY cl.vessel_id,cl.id`, raw => {
          if (!raw.spare) {
            if (raw.numeric_spare && !raw.numeric_spare.deleted && !raw.numeric_spare.is_deleted)
              throw new Error("A spare linkage has an inconsistent identity. Export was not downloaded.");
            excluded++; return;
          }
          const s = camel(raw.spare), c = raw.component ? camel(raw.component) : null;
          if (s.vesselId !== raw.vessel_id || (raw.spare_uuid && s.suuid !== raw.spare_uuid))
            throw new Error("A spare linkage could not be resolved in the selected vessel.");
          if (s.deleted || s.isDeleted) { excluded++; return; }
          if (q.activeOnly === "true" && s.isActive === false) return;
          if (s.dataScope !== "vessel") throw new Error("A linked spare was missing from the complete vessel inventory.");
          if (!c || c.dataScope === "fleet") throw new Error("Linked component could not be resolved. Export was not downloaded.");
          if (c.deleted || c.isDeleted || (q.activeOnly === "true" && c.isActive === false)) return;
          if (!c.componentCode || !c.name || !s.partCode || !s.partName) throw new Error("Incomplete component or spare details.");
          write(s, c);
        });
      }
      sheet.commit(); reference.commit(); lists.commit();
    });
    await workbook.commit();
    return { excluded, rowCount };
  } catch (error) {
    // Close the file-backed writer even if data validation failed; caller removes
    // the temporary directory and no partial workbook is offered for download.
    try { await workbook.commit(); } catch { /* retain original error */ }
    throw error;
  }
}
