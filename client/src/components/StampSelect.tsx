import { useQuery } from "@tanstack/react-query";

// Strict master-first stamp picker (Task #366): components can only SELECT stamps
// that already exist in the Rotation Item Master. Options are the vessel's
// available (Spare / In Store) stamps, shown as "STAMP — Name", plus the
// component's currently fitted stamp so editing keeps the selection visible.
interface MasterItem {
  riuuid: string;
  stamp: string;
  stampName: string | null;
  status: string;
}

interface StampSelectProps {
  vesselId: string;
  value: string;
  onChange: (stamp: string) => void;
  disabled?: boolean;
  /** the stamp currently fitted on the component being edited (kept selectable) */
  currentStamp?: string;
  className?: string;
  testId?: string;
}

export default function StampSelect({
  vesselId, value, onChange, disabled, currentStamp, className, testId,
}: StampSelectProps) {
  const url = `/technical/api/rotational-items?vesselId=${encodeURIComponent(vesselId)}`;
  const { data: items = [], isLoading } = useQuery<MasterItem[]>({
    queryKey: [url],
    queryFn: () => fetch(url).then((r) => {
      if (!r.ok) throw new Error("Failed to load rotation items");
      return r.json();
    }),
    enabled: !!vesselId && !disabled,
  });

  const selectable = items.filter(
    (it) => it.status === "Spare" || it.status === "In Store" || (currentStamp && it.stamp === currentStamp)
  );
  // Keep a stale/unknown current value visible instead of silently clearing it.
  const hasValue = value && selectable.some((it) => it.stamp === value);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
      data-testid={testId || "select-stamp"}
    >
      <option value="">{isLoading ? "Loading stamps..." : "Select stamp..."}</option>
      {!hasValue && value && <option value={value}>{value}</option>}
      {selectable.map((it) => (
        <option key={it.riuuid} value={it.stamp}>
          {it.stampName ? `${it.stamp} — ${it.stampName}` : it.stamp}
          {it.status !== "Spare" && it.status !== "In Store" ? ` (${it.status})` : ""}
        </option>
      ))}
    </select>
  );
}
