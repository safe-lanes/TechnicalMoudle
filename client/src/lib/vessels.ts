export const VESSELS = [
  { id: 'V001', name: 'MV SEAFARER' },
  { id: 'V002', name: 'MV VOYAGER' },
  { id: 'V003', name: 'MV EXPLORER' },
] as const;

export type VesselId = typeof VESSELS[number]['id'];

export function getVesselName(vesselId: string): string {
  return VESSELS.find(v => v.id === vesselId)?.name || vesselId;
}
