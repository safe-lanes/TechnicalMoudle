import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Express, Request, Response } from "express";

const api = vi.hoisted(() => ({
  generate: vi.fn(), edit: vi.fn(), toFile: vi.fn(),
}));
vi.mock("openai", () => ({
  default: class { images = { generate: api.generate, edit: api.edit }; },
  toFile: api.toFile,
}));
import { editImages, generateImageBuffer } from "../client";
import { registerImageRoutes } from "../routes";

let directory: string;
beforeEach(() => {
  vi.clearAllMocks();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "image-contract-"));
  api.toFile.mockImplementation(async (stream, name, options) => {
    // Consume real disposable files so streams close before cleanup.
    for await (const _chunk of stream) { /* no upload */ }
    return { name, type: options.type };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("image helpers without live AI calls", () => {
  it("decodes successful generation and preserves model/size requests", async () => {
    api.generate.mockResolvedValue({ data: [{ b64_json: Buffer.from("pixels").toString("base64") }] });
    expect(await generateImageBuffer("a ship")).toEqual(Buffer.from("pixels"));
    expect(api.generate).toHaveBeenLastCalledWith({
      model: "gpt-image-1", prompt: "a ship", size: "1024x1024",
    });
    await generateImageBuffer("small", "256x256");
    expect(api.generate).toHaveBeenLastCalledWith({
      model: "gpt-image-1", prompt: "small", size: "256x256",
    });
  });

  it.each([{}, { data: [] }, { data: [{}] }])(
    "keeps empty-buffer fallbacks, including zero-byte output overwrite: %j", async response => {
      api.generate.mockResolvedValue(response);
      api.edit.mockResolvedValue(response);
      expect(await generateImageBuffer("empty")).toEqual(Buffer.alloc(0));
      const output = path.join(directory, "output.png");
      fs.writeFileSync(output, "previous image");
      expect(await editImages([], "empty", output)).toEqual(Buffer.alloc(0));
      expect(fs.readFileSync(output)).toEqual(Buffer.alloc(0));
      expect(await editImages([], "no output path")).toEqual(Buffer.alloc(0));
    },
  );

  it("retains edit uploads, returned bytes and optional output-file behavior", async () => {
    const inputs = ["one.png", "two.png"].map(name => path.join(directory, name));
    inputs.forEach(file => fs.writeFileSync(file, "input"));
    const bytes = Buffer.from("edited pixels");
    api.edit.mockResolvedValue({ data: [{ b64_json: bytes.toString("base64") }] });
    const output = path.join(directory, "output.png");
    expect(await editImages(inputs, "combine", output)).toEqual(bytes);
    expect(fs.readFileSync(output)).toEqual(bytes);
    expect(api.toFile.mock.calls.map(([, name, options]) => [name, options]))
      .toEqual(inputs.map(name => [name, { type: "image/png" }]));
    expect(api.edit).toHaveBeenCalledWith({
      model: "gpt-image-1", prompt: "combine",
      image: inputs.map(name => ({ name, type: "image/png" })),
    });
    fs.unlinkSync(output);
    expect(await editImages(inputs, "without output")).toEqual(bytes);
    expect(fs.existsSync(output)).toBe(false);
  });
});

describe("image route response contract", () => {
  async function request(body: unknown) {
    let handler!: (req: Request, res: Response) => Promise<unknown>;
    const post = vi.fn((_url, callback) => { handler = callback; });
    registerImageRoutes({ post } as unknown as Express);
    expect(post).toHaveBeenCalledWith("/api/generate-image", expect.any(Function));
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ body } as Request, response as unknown as Response);
    return response;
  }

  it("keeps successful JSON and request defaults", async () => {
    api.generate.mockResolvedValue({ data: [{ url: "image-url", b64_json: "encoded" }] });
    const response = await request({ prompt: "ship" });
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ url: "image-url", b64_json: "encoded" });
    expect(api.generate).toHaveBeenCalledWith({
      model: "gpt-image-1", prompt: "ship", n: 1, size: "1024x1024",
    });
  });

  it.each([{}, { data: [] }])("rejects absent first images with the existing 500 JSON: %j", async data => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.generate.mockResolvedValue(data);
    const response = await request({ prompt: "ship" });
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledExactlyOnceWith({ error: "Failed to generate image" });
  });

  it("keeps missing-prompt validation and API failure handling", async () => {
    let response = await request({});
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: "Prompt is required" });
    expect(api.generate).not.toHaveBeenCalled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.generate.mockRejectedValue(new Error("upstream failure"));
    response = await request({ prompt: "ship", size: "512x512" });
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ error: "Failed to generate image" });
  });
});
