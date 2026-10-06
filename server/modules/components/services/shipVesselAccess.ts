import { ForbiddenError } from '../../shared/errors';

interface VesselUser {
  role: string;
  vesselId?: string;
}

/** Only constrains callers explicitly supplied a Ship identity; does not resolve the forwarded RBAC identity. */
export function assertShipVesselAccess(user: VesselUser, targetVessel?: string | null): void {
  if (user.role !== 'Ship') return;
  if (!user.vesselId || (targetVessel !== undefined && user.vesselId !== targetVessel)) {
    throw new ForbiddenError('Cannot access components outside the assigned vessel');
  }
}