import { Router } from 'express';
import vesselRoutes from './vessels/routes';
import componentRoutes from './components/routes';
import jobRoutes from './jobs/routes';
import workOrderRoutes from './work-orders/routes';
import runningHoursRoutes from './running-hours/routes';
import sparesRoutes from './spares/routes';
import storesRoutes from './stores/routes';
import defectsRoutes from './defects/routes';
import certSurveysRoutes from './cert-surveys/routes';
import fleetRoutes from './fleet/routes';
import reportRoutes from './reports/routes';
import changeRequestRoutes from './change-requests/routes';
import bulkUploadRoutes from './bulk-upload/routes';
import alertRoutes from './alerts/routes';
import formRoutes from './forms/routes';
import chatbotRoutes from './chatbot/routes';
import miscRoutes from './misc/routes';
import accessControlRoutes from './access-control/routes';
import ranksRoutes from './ranks/routes';
import syncRoutes from './sync/routes';
// ====== NOON REPORT MODULE — START (remove this line to disable) ======
import noonReportRoutes from './noon-report/routes';
// ====== NOON REPORT MODULE — END ======

const moduleRouter = Router();

// Extracted modules
moduleRouter.use(vesselRoutes);
moduleRouter.use(componentRoutes);
moduleRouter.use(jobRoutes);
moduleRouter.use(workOrderRoutes);
moduleRouter.use(runningHoursRoutes);
moduleRouter.use(sparesRoutes);
moduleRouter.use(storesRoutes);
moduleRouter.use(defectsRoutes);
moduleRouter.use(certSurveysRoutes);
moduleRouter.use(fleetRoutes);
moduleRouter.use(reportRoutes);
moduleRouter.use(changeRequestRoutes);
moduleRouter.use(bulkUploadRoutes);
moduleRouter.use(alertRoutes);
moduleRouter.use(formRoutes);
moduleRouter.use(chatbotRoutes);
moduleRouter.use(miscRoutes);
moduleRouter.use(accessControlRoutes);
moduleRouter.use(ranksRoutes);
moduleRouter.use(syncRoutes);
// ====== NOON REPORT MODULE — START (remove this line to disable) ======
moduleRouter.use(noonReportRoutes);
// ====== NOON REPORT MODULE — END ======

export default moduleRouter;
