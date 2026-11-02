import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classRegulatoryInput, surveyTypeCategoryLabel } from "@shared/classRegulatory";

const source = readFileSync("client/src/components/pms/ClassRegulatorySection.tsx", "utf8");

describe("Section H Survey Type/Category presentation boundaries", () => {
  it("formats values and categories with one separator and no key suffix", () => {
    expect(surveyTypeCategoryLabel("Annual Survey", "Class")).toBe("Annual Survey/Class");
    expect(surveyTypeCategoryLabel("Annual Survey", "Statutory")).toBe("Annual Survey/Statutory");
    expect(surveyTypeCategoryLabel(" Annual Survey ", " Class ")).toBe("Annual Survey/Class");
    expect(surveyTypeCategoryLabel("In-Water/Bottom Survey", "Class")).toBe("In-Water/Bottom Survey/Class");
  });
  it("makes missing data explicit without guessing or exposing a key", () => {
    expect(surveyTypeCategoryLabel("Saved Survey", null)).toBe("Saved Survey/Category unavailable");
    expect(surveyTypeCategoryLabel(null, "Class")).toBe("Unavailable survey type/Class");
    expect(surveyTypeCategoryLabel()).toBe("Unavailable survey type/Category unavailable");
  });
  it("keeps canonical keys in option values and uses the same formatter for active and retired choices", () => {
    expect(source).toContain('key={item.listKey} value={item.listKey}');
    expect(source).toContain('surveyTypeCategoryLabel(item.listValue, item.category)');
    expect(source).toContain('surveyTypeCategoryLabel(originalReferences.current.surveyType, originalReferences.current.surveyTypeCategory)');
    expect(source).toContain('control("surveyTypeKey", "Survey Type/Category"');
  });
  it("does not expose a missing or inactive survey key as its visible label", () => {
    const label = source.slice(source.indexOf("const surveyLabel"), source.indexOf("const saveEntry"));
    expect(label).not.toContain("master?.listKey");
    expect(label).toContain("surveyTypeCategoryLabel(entry.surveyType || master?.listValue, entry.surveyTypeCategory ?? master?.category)");
    expect(source).not.toContain("originalReferences.current.surveyType || originalReferences.current.surveyTypeKey");
    expect(source).toContain("The saved survey reference is inactive or unavailable.");
  });
  it("continues saving the selected key rather than substituting a label", () => {
    expect(source).toContain('Object.assign(payload, { surveyTypeKey: draft.surveyTypeKey })');
    expect(source).toContain('surveyTypeKey: entry?.surveyTypeKey || ""');
    expect(classRegulatoryInput.safeParse({ surveyTypeCategory: "Class" }).success).toBe(false);
    expect(classRegulatoryInput.safeParse({ surveyTypeKey: "ANN" }).success).toBe(true);
  });
});
