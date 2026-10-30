import { describe, expect, it } from "vitest";
import { classRegulatoryImportFeedback } from "@/lib/classRegulatoryImportFeedback";

describe("regulatory import feedback", () => {
  it("unwraps validation failures without raw HTTP/JSON", () => {
    expect(classRegulatoryImportFeedback(new Error('400: {"error":"Use the downloaded ten-column template."}'), "Retry"))
      .toBe("Use the downloaded ten-column template.");
  });
  it("does not expose server internals or HTML responses", () => {
    expect(classRegulatoryImportFeedback(new Error('500: {"error":"SQL stack trace"}'), "Retry"))
      .not.toMatch(/SQL|stack|500|error"/);
    expect(classRegulatoryImportFeedback(new Error("400: <html>Proxy error</html>"), "Retry")).toBe("Retry");
  });
  it("preserves client guidance and uses a safe fallback", () => {
    expect(classRegulatoryImportFeedback(new Error("Please sign in."), "Retry")).toBe("Please sign in.");
    expect(classRegulatoryImportFeedback(null, "Retry")).toBe("Retry");
  });
});
