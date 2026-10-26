import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { parse, validate } from "./sparesPagingController";
import { writeSpareExport } from "../services/sparesExportService";

export const exportFile = validate(async (req, res) => {
  const type = z.enum(["unique", "component", "history"]).parse(req.query.type);
  const q = await parse(req, type === "history" ? "history" : "inventory");
  const directory = await mkdtemp(path.join(tmpdir(), "spares-export-"));
  try {
    const filename = path.join(directory, "spares.xlsx");
    const { excluded, rowCount } = await writeSpareExport(filename, req.params.vesselId,
      { ...q, kind: type === "history" ? "history" : "inventory", filters: "{}", sort: "[]" }, type);
    if (!res.destroyed) {
      res.setHeader("X-Excluded-Unavailable-Spare-Links", String(excluded));
      res.setHeader("X-Spare-Export-Row-Count", String(rowCount));
      await new Promise<void>((resolve, reject) => {
        res.download(filename, "spares.xlsx", error => error ? reject(error) : resolve());
      });
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
