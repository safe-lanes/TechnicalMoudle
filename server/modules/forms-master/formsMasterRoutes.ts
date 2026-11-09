import { Router } from "express";
import * as controller from "./controllers/formsMasterController";
const router = Router();
router.get("/options", controller.options);
router.get("/roles", controller.roles);
router.get("/records", controller.records);
router.post("/records", controller.createRecord);
router.get("/records/:formUuid", controller.details);
router.put("/records/:formUuid", controller.updateRecord);
router.delete("/records/:formUuid", controller.deleteRecord);
router.post("/records/:formUuid/restore", controller.restoreRecord);
router.get("/groups", controller.listGroups);
router.get("/categories", controller.listCategories);
for (const [path, kind] of [["groups", "group"], ["categories", "category"]] as const) {
  const actions = controller.labelControllers(kind);
  router.put(`/${path}/order`, actions.order);
  router.post(`/${path}`, actions.create);
  router.put(`/${path}/:labelUuid`, actions.update);
  router.delete(`/${path}/:labelUuid`, actions.delete);
  router.post(`/${path}/:labelUuid/restore`, actions.restore);
}
export default router;
