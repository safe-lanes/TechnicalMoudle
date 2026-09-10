export interface CertificateMasterGroupLabel {
  key: string;
  label: string;
}

export function sortCertificateMasterGroupLabels<T extends CertificateMasterGroupLabel>(
  labels: T[],
): T[] {
  return [...labels].sort((left, right) =>
    left.key.localeCompare(right.key, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );
}