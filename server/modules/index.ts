import { Router } from 'express';
import vesselRoutes from './vessels/routes';
import componentRoutes from './components/routes';
import jobRoutes from './jobs/routes';
import workOrderRoutes from './work-orders/routes';
import runningHoursRoutes from './running-hours/routes';
import sparesRoutes from './spares/routes';
import storesRoutes from './stores/routes';
import defectsRoutes from './defects/routes';

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

export default moduleRouter;
