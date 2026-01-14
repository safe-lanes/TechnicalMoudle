import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search hardware class..." />
          <CommandList>
            <CommandEmpty>No hardware class found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {sireHardwareClasses.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.level1} ${item.level2} ${item.level3}`}
                  onSelect={() => {
                    onSelect(item.id, item.level1, item.level2, item.level3);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedId === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400">
                      {item.level1} &gt; {item.level2}
                    </span>
                    <span className="font-medium">{item.level3}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
