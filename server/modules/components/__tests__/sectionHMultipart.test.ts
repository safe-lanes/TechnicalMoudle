import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { SECTION_H_FILE_BYTES } from "@shared/sectionHAttachments";
// Parser-only test: no database or authentication wiring is exercised here.
vi.mock("../controllers/classRegulatoryController", () => ({ classRegulatoryHandler: (fn: any) => fn }));
vi.mock("../services/sectionHAttachmentService", () => ({}));
import { uploadBody } from "../controllers/sectionHAttachmentController";
let server: Server, url: string;
function multipart(size: number, extraField = false) {
  const data = new FormData();
  data.append("file", new Blob([new Uint8Array(size)], { type: "application/pdf" }), "fixture.pdf");
  data.append("attachmentUuid", crypto.randomUUID());
  if (extraField) data.append("unexpected", "x");
  return data;
}
describe("Section H real HTTP multipart limits", () => {
  beforeAll(async () => {
    const app = express();
    app.post("/", uploadBody, (req, res) => res.json({ bytes: req.file?.size, identity: req.body.attachmentUuid }));
    server = await new Promise<Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    url = `http://127.0.0.1:${(server.address() as any).port}/`;
  });
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); });
  it("accepts the UI's two-part file-first FormData", async () => {
    const response = await fetch(url, { method: "POST", body: multipart(589) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ bytes: 589 });
  });
  it("accepts exactly 10 MiB through the parser", async () => {
    const response = await fetch(url, { method: "POST", body: multipart(SECTION_H_FILE_BYTES) });
    expect(response.status).toBe(200);
  });
  it("refuses one byte above 10 MiB before application validation", async () => {
    const response = await fetch(url, { method: "POST", body: multipart(SECTION_H_FILE_BYTES + 1) });
    expect(response.status).toBe(400);
  });
  it("refuses extra form fields", async () => {
    const response = await fetch(url, { method: "POST", body: multipart(10, true) });
    expect(response.status).toBe(400);
  });
});
