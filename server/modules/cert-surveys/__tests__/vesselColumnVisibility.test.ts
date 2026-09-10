import { describe, expect, it } from 'vitest';
import { shouldShowCertificateVesselColumn } from '@shared/certificates/vesselColumnVisibility';

describe('Certificates Vessel column visibility', () => {
  it('shows the column when no explicit vessel selection is active', () => {
    expect(shouldShowCertificateVesselColumn([])).toBe(true);
  });

  it('hides the column when exactly one vessel is selected', () => {
    expect(shouldShowCertificateVesselColumn(['Vessel 1'])).toBe(false);
  });

  it('shows the column when multiple vessels are selected', () => {
    expect(shouldShowCertificateVesselColumn(['Vessel 1', 'Vessel 2'])).toBe(true);
  });
});