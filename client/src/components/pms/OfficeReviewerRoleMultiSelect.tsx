import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Role {
  ruid: string;
  assignedRole: string;
  roletype: string;
  sortOrder: number | null;
}

interface OfficeReviewerRoleMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  id?: string;
}

export function OfficeReviewerRoleMultiSelect({
  value,
  onChange,
  disabled = false,
  id = "office-reviewer-roles",
}: OfficeReviewerRoleMultiSelectProps) {
  const rolesQuery = useQuery<Role[]>({
    queryKey: ["/technical/api/admin/roles"],
  });

  const roles = useMemo(() => {
    const source = rolesQuery.data ?? [];
    const nameCounts = source.reduce<Record<string, number>>((counts, role) => {
      const name = role.assignedRole || "Unnamed role";
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {});
    return source.map((role) => ({
      ...role,
      label: (nameCounts[role.assignedRole || "Unnamed role"] || 0) > 1
        ? `${role.assignedRole || "Unnamed role"} · ${role.roletype || "Role"} · ${role.ruid.slice(-6)}`
        : role.assignedRole || "Unnamed role",
    }));
  }, [rolesQuery.data]);

  const roleById = useMemo(() => new Map(roles.map((role) => [role.ruid, role])), [roles]);
  const selected = Array.from(new Set(value.filter((ruid) => typeof ruid === "string" && ruid.length > 0)));
  const selectedLabels = selected.map((ruid) => roleById.get(ruid)?.label || `Unavailable role · ${ruid}`);

  const toggle = (ruid: string) => {
    const next = new Set(selected);
    if (next.has(ruid)) next.delete(ruid);
    else next.add(ruid);
    onChange(Array.from(next.values()));
  };

  return (
    <div className="space-y-2" data-testid={`${id}-field`}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label="Office Reviewer roles"
            data-testid={`${id}-trigger`}
            className="min-h-10 h-auto w-full justify-between gap-3 px-3 py-2 text-left font-normal"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {selected.length
                ? selectedLabels.join(", ")
                : rolesQuery.isLoading
                  ? "Loading roles…"
                  : "— None —"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
          <div className="max-h-72 overflow-y-auto p-1">
            {rolesQuery.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
              </div>
            ) : rolesQuery.isError ? (
              <div className="space-y-2 px-3 py-3 text-sm" role="alert">
                <p className="text-destructive">Roles could not be loaded. Saved selections are preserved.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => rolesQuery.refetch()}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            ) : roles.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No roles are available.</p>
            ) : (
              roles.map((role) => {
                const checked = selected.includes(role.ruid);
                return (
                  <button
                    key={role.ruid}
                    type="button"
                    disabled={disabled}
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(role.ruid)}
                    className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                    data-testid={`${id}-option-${role.ruid}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-input"}`} aria-hidden="true">
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{role.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={`${selected.length} Office Reviewer roles selected`}>
          {selected.map((ruid) => (
            <span key={ruid} className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs text-sky-900">
              <span className="truncate">{roleById.get(ruid)?.label || `Unavailable role · ${ruid}`}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(ruid)}
                  aria-label={`Remove ${roleById.get(ruid)?.label || ruid}`}
                  className="rounded-full hover:bg-sky-100"
                  data-testid={`${id}-remove-${ruid}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function formatOfficeReviewerRoles(value: unknown, roleCatalog: Role[] | undefined): string {
  const ruids = Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)))
    : [];
  if (!ruids.length) return "—";
  const roleMap = new Map((roleCatalog ?? []).map((role) => [role.ruid, role]));
  const duplicateCounts = (roleCatalog ?? []).reduce<Record<string, number>>((counts, role) => {
    counts[role.assignedRole || "Unnamed role"] = (counts[role.assignedRole || "Unnamed role"] || 0) + 1;
    return counts;
  }, {});
  return ruids.map((ruid) => {
    const role = roleMap.get(ruid);
    if (!role) return `Unavailable role · ${ruid}`;
    const label = role.assignedRole || "Unnamed role";
    return duplicateCounts[label] > 1 ? `${label} · ${role.roletype || "Role"} · ${ruid.slice(-6)}` : label;
  }).join(", ");
}
