import { Router } from 'express';
import vesselRoutes from './vessels/routes';
import componentRoutes from './components/routes';

const moduleRouter = Router();

// Extracted modules
moduleRouter.use(vesselRoutes);
moduleRouter.use(componentRoutes);

export default moduleRouter;
