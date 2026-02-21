import { Router } from 'express';

const moduleRouter = Router();

// Modules will be registered here as they're extracted:
// import vesselRoutes from './vessels/routes';
// import componentRoutes from './components/routes';
// ... etc

// moduleRouter.use('/vessels', vesselRoutes);
// moduleRouter.use('/components', componentRoutes);
// ... etc

export default moduleRouter;
