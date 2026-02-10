import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { StoresRepository } from "./repositories/storesRepository";
import { StoresService } from "./services/storesService";
import { StoresController } from "./controllers/storesController";

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((error: any) => {
      console.error("V2 Stores Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    });
  };
}

export function createStoresRouter(): Router {
  const repository = new StoresRepository();
  const service = new StoresService(repository);
  const controller = new StoresController(service);

  const router = Router();

  router.get("/:vesselId", asyncHandler((req, res) => controller.getStoresItems(req, res)));
  router.get("/:vesselId/history", asyncHandler((req, res) => controller.getStoresTransactionHistory(req, res)));
  router.get("/item/:id/history", asyncHandler((req, res) => controller.getStoresItemHistory(req, res)));
  router.post("/:vesselId/create", asyncHandler((req, res) => controller.createStoresItem(req, res)));
  router.put("/item/:id", asyncHandler((req, res) => controller.updateStoresItem(req, res)));
  router.post("/item/:id/adjust", asyncHandler((req, res) => controller.adjustStoresItem(req, res)));
  router.patch("/:vesselId/:id", asyncHandler((req, res) => controller.patchStoresItem(req, res)));
  router.delete("/item/:id", asyncHandler((req, res) => controller.deleteStoresItem(req, res)));
  router.post("/:vesselId/batch-consume", asyncHandler((req, res) => controller.batchConsumeStores(req, res)));
  router.post("/:vesselId/batch-receive", asyncHandler((req, res) => controller.batchReceiveStores(req, res)));

  return router;
}
