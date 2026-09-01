export interface VesselRhValidationSetting {
  vesselId: string;
  rhValidationEnabled?: boolean;
}

/**
 * Resolves the effective client-side RH policy for one component. The server
 * remains authoritative; this prevents the UI from blocking corrections that
 * an OFF-policy vessel is permitted to submit in a mixed-vessel list.
 */
export function isRhValidationEnabledForComponent(
  componentVesselId: string | null | undefined,
  fallbackVesselId: string | null | undefined,
  settings: VesselRhValidationSetting[],
): boolean {
  const vesselId = componentVesselId ?? fallbackVesselId;
  return settings.find(setting => setting.vesselId === vesselId)?.rhValidationEnabled !== false;
}