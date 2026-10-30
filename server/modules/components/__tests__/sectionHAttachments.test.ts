import { describe, it, expect } from "vitest";
import { CFB } from "xlsx";
import { assertAttachmentQuota, sectionHFileKey, SECTION_H_FILE_BYTES, SECTION_H_TOTAL_BYTES } from "@shared/sectionHAttachments";
import { validateSectionHUpload, validateDocxDirectory } from "../services/sectionHAttachmentValidation";
const vessel = "11111111-1111-4111-8111-111111111111";
const entry = "22222222-2222-4222-8222-222222222222";
const attachment = "33333333-3333-4333-8333-333333333333";
const pdf = Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n");
function file(name: string, type: string, bytes: Buffer) {
  return { originalname: name, mimetype: type, size: bytes.length, buffer: bytes };
}
function docx() {
  const compound = CFB.utils.cfb_new();
  CFB.utils.cfb_add(compound, "[Content_Types].xml", Buffer.from('<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  CFB.utils.cfb_add(compound, "_rels/.rels", Buffer.from('<Relationships><Relationship Target="word/document.xml"/></Relationships>'));
  CFB.utils.cfb_add(compound, "word/document.xml", Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'));
  return Buffer.from(CFB.write(compound, { type: "buffer", fileType: "zip" }));
}
describe("Section H attachment quotas and ownership", () => {
  it("accepts exact per-file, count and combined boundaries", () => {
    expect(() => assertAttachmentQuota(4, SECTION_H_TOTAL_BYTES - SECTION_H_FILE_BYTES, SECTION_H_FILE_BYTES)).not.toThrow();
  });
  it.each([[5, 0, 1], [0, 0, SECTION_H_FILE_BYTES + 1], [1, SECTION_H_TOTAL_BYTES, 1], [0, 0, 0], [0, 0, -1], [0, 0, NaN]])(
    "refuses invalid or exceeded quotas (%s,%s,%s)", (count, bytes, size) => expect(() => assertAttachmentQuota(count, bytes, size)).toThrow(),
  );
  it("uses immutable vessel/entry/document folders and sanitizes names", () => {
    expect(sectionHFileKey(vessel, entry, attachment, "Class report.docx")).toBe(`${vessel}/${entry}/${attachment}_Class_report.docx`);
    expect(() => sectionHFileKey(vessel, entry, attachment, "../../bad.pdf")).toThrow();
    expect(() => sectionHFileKey("../vessel", entry, attachment, "a.pdf")).toThrow();
  });
});
describe("Section H document validation (existing libraries only)", () => {
  it("accepts structurally recognizable PDFs", async () => {
    expect((await validateSectionHUpload(file("survey.pdf", "application/pdf", pdf))).contentType).toBe("application/pdf");
  });
  it("accepts DOCX package structure through bounded ZIP inspection and the existing CFB parser", async () => {
    await expect(validateSectionHUpload(file("survey.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx()))).resolves.toMatchObject({ name: "survey.docx" });
  });
  it("accepts a DOC compound container with WordDocument and table streams", async () => {
    const compound = CFB.utils.cfb_new();
    const fib = Buffer.alloc(64); fib.writeUInt16LE(0xa5ec);
    CFB.utils.cfb_add(compound, "WordDocument", fib);
    CFB.utils.cfb_add(compound, "1Table", Buffer.alloc(32));
    const bytes = Buffer.from(CFB.write(compound, { type: "buffer" }));
    await expect(validateSectionHUpload(file("survey.doc", "application/msword", bytes))).resolves.toMatchObject({ name: "survey.doc" });
  });
  it.each([
    ["bad.pdf", "application/pdf", Buffer.from("not a PDF")],
    ["bad.doc", "application/msword", pdf],
    ["bad.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf],
    ["bad.pdf", "application/msword", pdf],
    ["../bad.pdf", "application/pdf", pdf],
    ["bad.pdf", "application/pdf", Buffer.alloc(0)],
    ["bad.exe", "application/pdf", pdf],
  ])("refuses disguised/empty/unsafe %s", async (name, mime, bytes) => {
    await expect(validateSectionHUpload(file(String(name), String(mime), bytes as Buffer))).rejects.toThrow();
  });
  it("bounds inflated ZIP entries before decompression", () => {
    const bytes = docx();
    const central = bytes.indexOf(Buffer.from("504b0102", "hex"));
    bytes.writeUInt32LE(100 * 1024 * 1024, central + 24);
    expect(() => validateDocxDirectory(bytes)).toThrow();
  });
});
