import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Marker } from "@/components/Marker";
import { normalizeOfficeReviewerRoleRuids } from "@shared/officeReviewer";

export { normalizeOfficeReviewerRoleRuids, sameOfficeReviewerRoles } from "@shared/officeReviewer";

export interface OfficeReviewerRole {
  id: number;
  ruid: string;
  assignedRole: string;
  roletype: string;
  isActive: boolean;
  sortOrder: number | null;
}

export function useOfficeReviewerRoles() {
  return useQuery<OfficeReviewerRole[]>({
    queryKey: ["/technical/api/admin/roles"],
  });
}

export function officeReviewerRoleLabel(ruid: string, roles: OfficeReviewerRole[] = []): string {
  const role = roles.find((item) => item.ruid === ruid);
  if (!role) return `Role unavailable · ${ruid}`;
  const duplicateName = roles.some((item) => item.ruid !== role.ruid && item.assignedRole === role.assignedRole);
  return duplicateName
    ? `${role.assignedRole} · ${role.roletype || "Role"} · ${role.ruid}`
    : role.assignedRole;
}

interface OfficeReviewerRoleSelectProps {
  value: unknown;
  onChange?: (ruids: string[]) => void;
  label?: string;
  disabled?: boolean;
  changed?: boolean;
  testId?: string;
  labelMarker?: string;
  valueMarker?: string;
}

export function OfficeReviewerRoleSelect({
  value,
  onChange,
  label = "Office Reviewer",
  disabled = false,
  changed = false,
  testId = "office-reviewer-role-select",
  labelMarker,
  valueMarker,
}: OfficeReviewerRoleSelectProps) {
  const rolesQuery = useOfficeReviewerRoles();
  const selected = normalizeOfficeReviewerRoleRuids(value);
  const roles = rolesQuery.data ?? [];
  const selectedLabels = selected.map((ruid) => ({ ruid, label: officeReviewerRoleLabel(ruid, roles) }));
  const activeRuidSet = new Set(selected);

  const toggle = (ruid: string) => {
    if (!onChange) return;
    onChange(normalizeOfficeReviewerRoleRuids(activeRuidSet.has(ruid)
      ? selected.filter((selectedRuid) => selectedRuid !== ruid)
      : [...selected, ruid]));
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      {label && <Label className={`text-sm ${changed ? "text-red-600 font-semibold" : "text-[#8798ad]"}`} data-testid={labelMarker}>
        {labelMarker && <Marker id={labelMarker} />}
        {label} {changed && <span>(Modified)</span>}
      </Label>}
      <div data-testid={valueMarker}>
      {valueMarker && <Marker id={valueMarker} />}
      {disabled ? (
        <div className="min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" aria-label={label}>
          {selectedLabels.length
            ? <div className="flex flex-wrap gap-1.5">{selectedLabels.map(({ ruid, label: roleLabel }) => <span key={ruid} className="rounded bg-white border px-2 py-1 text-gray-700">{roleLabel}</span>)}</div>
            : <span className="text-gray-500">— None —</span>}
        </div>
      ) : (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className={cn("w-full min-h-10 justify-between font-normal", changed && "border-red-500 bg-red-50")}
                data-testid={`${testId}-trigger`}
              >
                <span className="truncate text-left">
                  {selected.length === 0 ? "— None —" : `${selected.length} role${selected.length === 1 ? "" : "s"} selected`}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search roles…" />
                <CommandList>
                  {rolesQuery.isLoading ? (
                    <div className="px-3 py-5 text-sm text-gray-500" role="status">Loading roles…</div>
                  ) : rolesQuery.isError ? (
                    <div className="space-y-2 px-3 py-4 text-sm text-red-700" role="alert">
                      <p>Roles could not be loaded. Your current selection is preserved.</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => rolesQuery.refetch()}>
                        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  ) : roles.length === 0 ? (
                    <div className="px-3 py-5 text-sm text-gray-500" role="status">No active roles are available.</div>
                  ) : (
                    <>
                      <CommandEmpty>No roles match your search.</CommandEmpty>
                      <CommandGroup heading="Available roles">
                        {roles.map((role) => {
                          const isSelected = activeRuidSet.has(role.ruid);
                          return (
                            <CommandItem
                              key={role.ruid}
                              value={`${role.assignedRole} ${role.roletype} ${role.ruid}`}
                              onSelect={() => toggle(role.ruid)}
                              className="gap-2"
                              data-testid={`office-reviewer-option-${role.ruid}`}
                            >
                              <Checkbox checked={isSelected} aria-hidden="true" tabIndex={-1} />
                              <span className="min-w-0 flex-1 truncate">{officeReviewerRoleLabel(role.ruid, roles)}</span>
                              {isSelected && <Check className="h-4 w-4 text-emerald-700" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedLabels.map(({ ruid, label: roleLabel }) => (
                <span key={ruid} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700" data-testid={`selected-office-reviewer-${ruid}`}>
                  {roleLabel}
                  <button type="button" onClick={() => toggle(ruid)} aria-label={`Remove ${roleLabel}`} className="rounded-sm text-slate-500 hover:text-red-700">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {rolesQuery.isError && <p className="text-xs text-amber-700">Saved role IDs remain selected until the catalog is available.</p>}
        </>
      )}
      </div>
    </div>
  );
}
