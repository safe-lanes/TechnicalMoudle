import { describe, expect, it } from 'vitest';
import {
  createCertificateCompanyGroupLabelMap,
  formatCertificateCompanyGroup,
  getNextCertificateCompanyGroupKey,
  incrementAlphabeticKey,
} from '@shared/certificates/companyGroupLabels';

describe('certificate Company Group labels', () => {
  describe('alphabetic key sequencing', () => {
    it.each([
      ['A', 'B'],
      ['Y', 'Z'],
      ['Z', 'AA'],
      ['AA', 'AB'],
      ['AZ', 'BA'],
      ['ZZ', 'AAA'],
    ])('increments %s to %s', (current, expected) => {
      expect(incrementAlphabeticKey(current)).toBe(expected);
    });

    it('starts at A for an empty list and continues from the last saved key', () => {
      expect(getNextCertificateCompanyGroupKey([])).toBe('A');
      expect(getNextCertificateCompanyGroupKey([
        { key: 'Y' },
        { key: 'Z' },
      ])).toBe('AA');
      expect(getNextCertificateCompanyGroupKey([
        { key: 'Z' },
        { key: 'AA' },
      ])).toBe('AB');
    });
  });

  it('formats configured keys using the Admin label convention', () => {
    const labels = createCertificateCompanyGroupLabelMap([
      { key: 'A', label: 'Statutory' },
      { key: 'B', label: 'Value Add' },
      { key: 'C', label: 'Others' },
    ]);

    expect(formatCertificateCompanyGroup('A', labels)).toBe('A. Statutory');
    expect(formatCertificateCompanyGroup('B', labels)).toBe('B. Value Add');
    expect(formatCertificateCompanyGroup('C', labels)).toBe('C. Others');
  });

  it('uses the current configured label instead of changing the key', () => {
    const labels = createCertificateCompanyGroupLabelMap([
      { key: 'A', label: 'Reclassified' },
    ]);

    expect(formatCertificateCompanyGroup('A', labels)).toBe('A. Reclassified');
  });

  it('falls back safely for blank labels, unknown keys, and blank values', () => {
    const labels = createCertificateCompanyGroupLabelMap([
      { key: 'D', label: '' },
    ]);

    expect(formatCertificateCompanyGroup('D', labels)).toBe('D');
    expect(formatCertificateCompanyGroup('Z', labels)).toBe('Z');
    expect(formatCertificateCompanyGroup('', labels)).toBe('');
    expect(formatCertificateCompanyGroup(null, labels)).toBe('');
  });

  it('uses the Admin defaults when no saved configuration exists', () => {
    const labels = createCertificateCompanyGroupLabelMap([]);

    expect(formatCertificateCompanyGroup('A', labels)).toBe('A. Statutory');
    expect(formatCertificateCompanyGroup('B', labels)).toBe('B. Value Add');
    expect(formatCertificateCompanyGroup('C', labels)).toBe('C. Others');
  });
});