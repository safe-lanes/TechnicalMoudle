import { describe, expect, it } from 'vitest';
import { sortCertificateMasterGroupLabels } from '@shared/certificates/masterGroupLabels';

describe('certificate Master Group labels', () => {
  it('includes every configured group in numeric key order', () => {
    const labels = sortCertificateMasterGroupLabels([
      { key: '11', label: 'Additional' },
      { key: '2', label: 'Environment' },
      { key: '10', label: 'Insurance' },
      { key: '1', label: 'Safety' },
    ]);

    expect(labels.map(({ key }) => key)).toEqual(['1', '2', '10', '11']);
    expect(labels.find(({ key }) => key === '11')?.label).toBe('Additional');
  });

  it('does not mutate the configured label list', () => {
    const labels = [
      { key: '10', label: 'Insurance' },
      { key: '2', label: 'Environment' },
    ];

    sortCertificateMasterGroupLabels(labels);

    expect(labels.map(({ key }) => key)).toEqual(['10', '2']);
  });
});