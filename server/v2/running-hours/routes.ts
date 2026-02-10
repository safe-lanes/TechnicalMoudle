import { Router } from "express";
import {
  getParents,
  getChildren,
  updateChildRH,
  resetChildRH,
  getMasterComponents,
  getRHConfig,
  updateRHConfig,
  updateMasterRH,
  getInheritedComponents,
  propagateAll,
} from "./controllers/runningHoursController";

const router = Router();

router.get("/running-hours/parents", getParents);
router.get("/running-hours/children/:parentCode", getChildren);
router.put("/running-hours/child/:componentId", updateChildRH);
router.post("/running-hours/reset-child/:componentId", resetChildRH);
router.post("/running-hours/propagate-all", propagateAll);

router.get("/rh-config/master-components/:vesselId", getMasterComponents);
router.get("/rh-config/:componentId", getRHConfig);
router.put("/rh-config/:componentId", updateRHConfig);
router.put("/rh-config/master/:componentId", updateMasterRH);
router.get("/rh-config/inherited/:masterComponentId", getInheritedComponents);

export default router;
