import { useState, useMemo, useRef, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { sireHardwareClasses } from "@/data/sireHardwareClasses";

interface SireHardwareClassComboboxProps {
  selectedId: string;
  displayValue: string;
  onSelect: (id: string, level1: string, level2: string, level3: string) => void;
  disabled?: boolean;
  placeholder?: string;
  testId?: string;
}

export function SireHardwareClassCombobox({
  selectedId,
  displayValue,
  onSelect,
  disabled = false,
  placeholder = "Select hardware class",
  testId = "combobox-sire-hardware-class",
}: SireHardwareClassComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return sireHardwareClasses;
    const searchLower = search.toLowerCase().trim();
    return sireHardwareClasses.filter((item) => 
      item.level1.toLowerCase().includes(searchLower) ||
      item.level2.toLowerCase().includes(searchLower) ||
      item.level3.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target) {
      target.scrollTop += e.deltaY;
      e.stopPropagation();
    }
  }, []);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearch("");
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          className="w-full h-10 justify-between text-sm border-gray-300 font-normal"
        >
          <span className={cn("truncate", !displayValue && "text-muted-foreground")}>
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[500px] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col">
          <div className="p-2 border-b">
            <Input
              placeholder="Search hardware class..."
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
              maxHeight: '300px',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
          >
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No hardware class found.
              </div>
            ) : (
              <div className="p-1">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelect(item.id, item.level1, item.level2, item.level3);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover-elevate",
                      selectedId === item.id && "bg-accent"
                    )}
                    data-testid={`${testId}-option-${item.id}`}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        selectedId === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground">
                        {item.level1} &gt; {item.level2}
                      </span>
                      <span className="font-medium">{item.level3}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
