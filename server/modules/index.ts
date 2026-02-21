import { Router } from 'express';
import vesselRoutes from './vessels/routes';

const moduleRouter = Router();

// Extracted modules
moduleRouter.use(vesselRoutes);

export default moduleRouter;
