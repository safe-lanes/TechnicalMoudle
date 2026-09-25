import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { devTestUsersGuard } from './devTestUsersGuard';
import {
  assignDevTestUserVessel,
  getDevTestUserResolution,
  listDevTestUsers,
  removeDevTestUserVessel,
} from './controllers/devTestUsersController';

const router = Router();

router.use('/dev/test-users', devTestUsersGuard);
router.get('/dev/test-users', asyncHandler(listDevTestUsers));
router.get('/dev/test-users/:userId/resolution', asyncHandler(getDevTestUserResolution));
router.post('/dev/test-users/:userId/vessels', asyncHandler(assignDevTestUserVessel));
router.delete('/dev/test-users/:userId/vessels/:vuuid', asyncHandler(removeDevTestUserVessel));

export default router;