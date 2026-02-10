import { Router } from "express";
import {
  list,
  getById,
  getContext,
  create,
  update,
  remove,
  complete,
  bulkApproveHandler,
  bulkRejectHandler,
  autoGenerateHandler,
  recalculateStatusesHandler,
  checkPostponementsHandler,
} from "./controllers/workOrderController";

export function createWorkOrderRouter(): Router {
  const router = Router();

  router.get("/", list);

  router.post("/", create);
  router.post("/bulk-approve", bulkApproveHandler);
  router.post("/bulk-reject", bulkRejectHandler);
  router.post("/auto-generate", autoGenerateHandler);
  router.post("/recalculate-statuses", recalculateStatusesHandler);
  router.post("/check-postponements", checkPostponementsHandler);

  router.get("/:id", getById);
  router.get("/:id/context", getContext);
  router.patch("/:id", update);
  router.delete("/:id", remove);
  router.post("/:id/complete", complete);

  return router;
}
