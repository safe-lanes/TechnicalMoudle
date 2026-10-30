import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/components/pms/ClassRegulatorySection.tsx", "utf8");

describe("Section H value-only Survey Type presentation boundaries", () => {
  it("keeps canonical keys in option values without appending category or key to their text", () => {
    expect(source).toContain('key={item.listKey} value={item.listKey}>{item.listValue}');
    expect(source).not.toContain("[item.category, item.listKey]");
    expect(source).toContain('name === "classificationSocietyKey" && item.country');
  });
  it("does not expose a missing or inactive survey key as its visible label", () => {
    const label = source.slice(source.indexOf("const surveyLabel"), source.indexOf("const saveEntry"));
    expect(label).not.toContain("master?.listKey");
    expect(label).not.toContain("master?.category");
    expect(label).toContain('entry.surveyType || master?.listValue || "Unavailable survey type"');
    expect(source).not.toContain("originalReferences.current.surveyType || originalReferences.current.surveyTypeKey");
    expect(source).toContain("The saved survey reference is inactive or unavailable.");
  });
  it("continues saving the selected key rather than substituting a label", () => {
    expect(source).toContain('Object.assign(payload, { surveyTypeKey: draft.surveyTypeKey })');
    expect(source).toContain('surveyTypeKey: entry?.surveyTypeKey || ""');
  });
});
