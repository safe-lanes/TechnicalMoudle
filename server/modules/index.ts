import { Router } from 'express';
import vesselRoutes from './vessels/routes';
import componentRoutes from './components/routes';
import jobRoutes from './jobs/routes';
import workOrderRoutes from './work-orders/routes';

const moduleRouter = Router();

// Extracted modules
moduleRouter.use(vesselRoutes);
moduleRouter.use(componentRoutes);
moduleRouter.use(jobRoutes);
moduleRouter.use(workOrderRoutes);

export default moduleRouter;
