export interface CertificateLabelConfig {
  key: string;
  label: string;
}

export function incrementAlphabeticKey(value: string): string {
  const key = value.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(key)) {
    return 'A';
  }

  const characters = key.split('');
  let carry = true;

  for (let index = characters.length - 1; index >= 0 && carry; index -= 1) {
    if (characters[index] === 'Z') {
      characters[index] = 'A';
    } else {
      characters[index] = String.fromCharCode(characters[index].charCodeAt(0) + 1);
      carry = false;
    }
  }

  if (carry) {
    characters.unshift('A');
  }

  return characters.join('');
}

export function getNextCertificateCompanyGroupKey(
  labels: Pick<CertificateLabelConfig, 'key'>[],
): string {
  if (labels.length === 0) return 'A';
  return incrementAlphabeticKey(labels[labels.length - 1].key);
}

export const DEFAULT_CERTIFICATE_COMPANY_GROUP_LABELS: CertificateLabelConfig[] = [
  { key: 'A', label: 'Statutory' },
  { key: 'B', label: 'Value Add' },
  { key: 'C', label: 'Others' },
  { key: 'D', label: '' },
  { key: 'E', label: '' },
  { key: 'F', label: '' },
  { key: 'G', label: '' },
  { key: 'H', label: '' },
  { key: 'I', label: '' },
];

export function createCertificateCompanyGroupLabelMap(
  labels: CertificateLabelConfig[] | null | undefined,
): ReadonlyMap<string, string> {
  const effectiveLabels = labels?.length
    ? labels
    : DEFAULT_CERTIFICATE_COMPANY_GROUP_LABELS;

  return new Map(
    effectiveLabels.map(({ key, label }) => [
      String(key).trim(),
      String(label ?? '').trim(),
    ]),
  );
}

export function formatCertificateCompanyGroup(
  value: unknown,
  labels: ReadonlyMap<string, string>,
): string {
  const key = String(value ?? '').trim();
  if (!key) return '';

  const label = labels.get(key);
  return label ? `${key}. ${label}` : key;
}