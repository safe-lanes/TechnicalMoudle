import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isClassComponent } from "@shared/classRegulatory";
import { resolveSectionHComponent } from "../../../../client/src/lib/sectionHComponent";

describe("Section H saved classification display boundaries", () => {
  it.each([true, "Yes"])("recognizes explicit Class Item %s", value => {
    expect(isClassComponent(value)).toBe(true);
  });
  it.each([false, "No", null, undefined, "", "true", 1])("does not guess classification for %s", value => {
    expect(isClassComponent(value)).toBe(false);
  });
  it("gates the complete register and rebinds the selection when saved data refreshes", () => {
    const page = readFileSync("client/src/pages/pms/Components.tsx", "utf8");
    expect(page).toContain('.filter(section => section.id !== "H" || isClassItem)');
    expect(page).toContain("isClassComponent(selectedComponent?.classItem)");
    expect(page).toContain("return findComponentNode(componentTreeData, node =>");
    const section = readFileSync("client/src/components/pms/ClassRegulatorySection.tsx", "utf8");
    expect(section).toContain("if (props.classItem !== true) return null");
    expect(section).not.toContain("classItem = true");
    expect(section).not.toContain("Records remain visible and are not removed");
  });
  it("uses saved parent data, not the unsaved edit draft, in both embedded forms", () => {
    for (const name of ["ComponentRegisterAddEdit", "AddEditComponentForm"]) {
      const source = readFileSync(`client/src/components/${name}.tsx`, "utf8");
      expect(source).toContain(name === "ComponentRegisterAddEdit"
        ? "isClassComponent(sectionHComponent?.classItem)" : "isClassComponent(existingComponent?.classItem)");
      expect(source).not.toMatch(/<ClassRegulatorySection[^>]+componentData\.classItem/);
    }
  });
  it.each([undefined, "original-legacy-id"])("follows tree selection with initial componentId=%s", initialId => {
    const vessel = "vessel-a";
    const original = { id: "original-legacy-id", cuuid: "8eb5b00d-55cb-4c0f-8b62-000000000191", vesselId: vessel, classItem: false };
    const selected = { id: "selected-legacy-id", cuuid: "8eb5b00d-55cb-4c0f-8b62-000000000192", vesselId: vessel, classItem: true };
    const register = [original, selected];
    const originalDetails = initialId ? original : undefined;
    let treeSelection: typeof original | undefined;
    const current = () => resolveSectionHComponent(register, treeSelection || originalDetails, vessel);
    expect(isClassComponent(current()?.classItem)).toBe(false);
    // Mirrors the tree's saved identity snapshot, including its display-only id.
    treeSelection = { ...selected, id: "601.002", componentId: selected.id } as typeof original;
    expect(current()?.cuuid).toBe(selected.cuuid);
    expect(isClassComponent(current()?.classItem)).toBe(true);
    treeSelection = { ...original, id: "601.001", componentId: original.id } as typeof original;
    expect(current()?.cuuid).toBe(original.cuuid);
    expect(isClassComponent(current()?.classItem)).toBe(false);
    // A register refresh (save/approval) wins over the old selection snapshot.
    register[0] = { ...original, classItem: true };
    expect(isClassComponent(current()?.classItem)).toBe(true);
    register[0] = { ...original, classItem: false };
    expect(isClassComponent(current()?.classItem)).toBe(false);
  });
  it("refuses wrong-vessel, missing or code-only selections rather than retargeting Section H", () => {
    const record = { id: "legacy", cuuid: "8eb5b00d-55cb-4c0f-8b62-000000000191", vesselId: "vessel-a", classItem: true };
    expect(resolveSectionHComponent([record], record, "vessel-b")).toBeUndefined();
    expect(resolveSectionHComponent([], record, "vessel-a")).toBeUndefined();
    expect(resolveSectionHComponent([record], { id: "601.001" }, "vessel-a")).toBeUndefined();
    expect(resolveSectionHComponent([record], null, "vessel-a")).toBeUndefined();
  });
  it("includes warnings in Section H import totals and keeps messages separate from errors", () => {
    const source = readFileSync("client/src/components/admin/UniformBulkUpload.tsx", "utf8");
    expect(source).toContain("isClassRegulatory ? dryRunResult.summary.warnings : 0");
    expect(source).toContain("isClassRegulatory ? row.warnings || [] : []");
    expect(source).toContain("row.status === 'ok' || row.status === 'warning'");
    expect(source).toContain("getValidRowsCount() === 0");
  });
});
