import { Router } from 'express';
import vesselRoutes from './vessels/routes';
import componentRoutes from './components/routes';
import jobRoutes from './jobs/routes';

const moduleRouter = Router();

// Extracted modules
moduleRouter.use(vesselRoutes);
moduleRouter.use(componentRoutes);
moduleRouter.use(jobRoutes);

export default moduleRouter;
