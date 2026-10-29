import type { NextFunction, Response } from "express";
import type { SectionHRequest } from "../../components/services/classRegulatoryAccess";
import { verifiedSectionHActor } from "../../components/services/classRegulatoryAccess";
import { requirePermission, type PermissionAction } from "../../../middleware/permissions";
import { storage } from "../../../storage";

const isRegulatory = (type: unknown) => type === "classificationSociety" || type === "surveyType";
/** Tighten only new regulatory master mutations, preserving all unrelated master guards. */
export const regulatoryMasterAccess = (action: PermissionAction) =>
  async (req: SectionHRequest, res: Response, next: NextFunction) => {
    try {
      const existing = req.params.id ? await storage.getMasterListById(Number(req.params.id)) : undefined;
      if (!isRegulatory(existing?.listType) && !isRegulatory(req.body?.listType)) return next();
      const actor = verifiedSectionHActor(req);
      if (actor.userType !== "Office") return res.status(403).json({ error: "Office master-data permission is required." });
      // Technical tracking/deletion properties cannot be set through a master business form.
      if (action !== "delete") {
        req.body = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) =>
          ["listType", "listKey", "listValue", "displayOrder", "isActive", "country", "category", "description"].includes(key)));
        req.body.updatedByUuid = actor.userId;
        if (action === "create") req.body.createdByUuid = actor.userId;
      }
      return requirePermission("admin-masters", action, { enforce: true, unconfigured: "deny" })(req, res, next);
    } catch (error: any) {
      const status = error?.statusCode === 403 ? 403 : 503;
      console.error("[Section H masters] mutation refused", error);
      return res.status(status).json({ error: status === 403 ? "A verified Office session is required." : "Master data is temporarily unavailable." });
    }
  };
