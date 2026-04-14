import { useState, useMemo, useRef, useCallback } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";

interface ComponentRecord {
  id: string;
  cuuid: string;
  componentCode: string;
  name: string;
  parentId: string | null;
  isParent: boolean;
  maker: string | null;
  model: string | null;
  vesselId: string;
}

interface FlatComponent {
  id: string;
  cuuid: string;
  code: string;
  name: string;
  parentId: string | null;
  isParent: boolean;
  maker: string | null;
  model: string | null;
  breadcrumb: string;
}

export interface VesselComponentSelection {
  id: string;
  code: string;
  name: string;
  breadcrumb: string;
  maker: string | null;
  model: string | null;
}

interface VesselComponentComboboxProps {
  vesselId: string;
  selectedId: string;
  displayValue: string;
  onSelect: (selection: VesselComponentSelection) => void;
  disabled?: boolean;
  placeholder?: string;
  testId?: string;
}

function buildBreadcrumb(
  component: ComponentRecord,
  allComponents: ComponentRecord[]
): string {
  const parts: string[] = [];
  let current: ComponentRecord | undefined = component;
  const visited = new Set<string>();

  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    const parent = allComponents.find(
      (c) => c.id === current!.parentId || c.componentCode === current!.parentId
    );
    if (parent) {
      parts.unshift(parent.name || parent.componentCode || parent.id);
      current = parent;
    } else {
      break;
    }
  }

  return parts.join(" > ");
}

const ROOT_CATEGORIES: Record<string, string> = {
  "1": "Ship General",
  "2": "Hull",
  "3": "Equipment for Cargo",
  "4": "Ship's Equipment",
  "5": "Equipment for Crew & Passengers",
  "6": "Machinery Main Components",
  "7": "Systems for Machinery Main Components",
  "8": "Ship Common Systems",
};

export function VesselComponentCombobox({
  vesselId,
  selectedId,
  displayValue,
  onSelect,
  disabled = false,
  placeholder = "Select component",
  testId = "combobox-vessel-component",
}: VesselComponentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const { data: rawComponents = [], isLoading, isError } = useQuery<ComponentRecord[]>({
    queryKey: ["/technical/api/components", vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const res = await fetch(`/technical/api/components/${vesselId}`);
      if (!res.ok) throw new Error(`Failed to load components (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!vesselId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const leafComponents = useMemo(() => {
    if (!rawComponents.length) return [];

    const leaves: FlatComponent[] = [];

    for (const comp of rawComponents) {
      if (comp.isParent) continue;

      let breadcrumb = buildBreadcrumb(comp, rawComponents);

      if (!breadcrumb) {
        const codePrefix = (comp.componentCode || comp.id || "").split(".")[0]?.charAt(0);
        if (codePrefix && ROOT_CATEGORIES[codePrefix]) {
          breadcrumb = ROOT_CATEGORIES[codePrefix];
        }
      }

      const cleanValue = (val: string | null | undefined): string | null => {
        if (!val || val === "NULL" || val === "null" || val.trim() === "") return null;
        return val;
      };

      leaves.push({
        id: comp.id,
        cuuid: comp.cuuid,
        code: comp.componentCode || comp.id,
        name: comp.name || comp.componentCode || comp.id,
        parentId: comp.parentId,
        isParent: false,
        maker: cleanValue(comp.maker),
        model: cleanValue(comp.model),
        breadcrumb,
      });
    }

    leaves.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    return leaves;
  }, [rawComponents]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return leafComponents;
    const searchLower = search.toLowerCase().trim();
    return leafComponents.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        item.code.toLowerCase().includes(searchLower) ||
        item.breadcrumb.toLowerCase().includes(searchLower) ||
        (item.maker && item.maker.toLowerCase().includes(searchLower))
    );
  }, [search, leafComponents]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target) {
      target.scrollTop += e.deltaY;
      e.stopPropagation();
    }
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !vesselId}
          data-testid={testId}
          className="w-full h-10 justify-between text-sm border-gray-300 font-normal"
        >
          <span
            className={cn(
              "truncate",
              !displayValue && "text-muted-foreground"
            )}
          >
            {displayValue || (!vesselId ? "Select vessel first" : placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[560px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col">
          <div className="p-2 border-b">
            <Input
              placeholder="Search by name, code, or maker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
              autoFocus
              data-testid={`${testId}-search`}
            />
          </div>
          <div
            ref={listRef}
            onWheel={handleWheel}
            className="overflow-y-scroll overscroll-contain"
            style={{
              maxHeight: "300px",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
            }}
          >
            {isLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading components...
              </div>
            ) : isError ? (
              <div className="py-6 text-center text-sm text-red-500">
                Failed to load components. Please try again.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {leafComponents.length === 0
                  ? "No components found for this vessel."
                  : "No matching components found."}
              </div>
            ) : (
              <div className="p-1">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelect({
                        id: item.cuuid || item.id,
                        code: item.code,
                        name: item.name,
                        breadcrumb: item.breadcrumb,
                        maker: item.maker,
                        model: item.model,
                      });
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent/50",
                      (selectedId === (item.cuuid || item.id)) && "bg-accent"
                    )}
                    data-testid={`${testId}-option-${item.code}`}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        (selectedId === (item.cuuid || item.id))
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground truncate">
                        {item.breadcrumb || "Root"}
                      </span>
                      <span className="font-medium text-sm">
                        {item.code} - {item.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!isLoading && leafComponents.length > 0 && (
            <div className="px-3 py-1.5 border-t text-xs text-muted-foreground">
              {filteredItems.length} of {leafComponents.length} components
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
