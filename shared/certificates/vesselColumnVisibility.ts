export function shouldShowCertificateVesselColumn(
  selectedVesselNames: readonly string[],
): boolean {
  return selectedVesselNames.length !== 1;
}