import { storage } from '../../../storage';

export async function ensureVesselExists(vesselId: string, vesselName: string): Promise<void> {
  const existing = await storage.getVessel(vesselId);
  if (existing) return;

  console.log(`Auto-creating vessel record: ${vesselName} (${vesselId})`);
  await storage.createVessel({
    id: vesselId,
    vuuid: vesselId,
    name: vesselName,
    code: vesselId,
    isActive: true,
  });
}
