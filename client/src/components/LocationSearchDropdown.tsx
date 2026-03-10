import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { MapPin, Check, Plus, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LocationItem {
  id: number;
  vesselId: string;
  locationName: string;
  locationType?: string | null;
}

interface LocationSearchDropdownProps {
  vesselId: string;
  value: string;
  onChange: (locationName: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

export function LocationSearchDropdown({
  vesselId,
  value,
  onChange,
  placeholder = "Select location...",
  disabled = false,
  "data-testid": testId,
}: LocationSearchDropdownProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const newLocationInputRef = useRef<HTMLInputElement>(null);

  const { data: locationsResponse, isLoading } = useQuery<any>({
    queryKey: [`/technical/api/inventory/locations/${vesselId}`],
    enabled: !!vesselId,
  });

  const locations: LocationItem[] = Array.isArray(locationsResponse)
    ? locationsResponse
    : (locationsResponse?.data ?? []);

  useEffect(() => {
    if (isCreating && newLocationInputRef.current) {
      newLocationInputRef.current.focus();
    }
  }, [isCreating]);

  const handleSelect = (locationName: string) => {
    onChange(locationName);
    setOpen(false);
    setIsCreating(false);
    setNewLocationName("");
  };

  const handleCreateNew = async () => {
    const trimmed = newLocationName.trim();
    if (!trimmed) return;

    setIsSaving(true);
    try {
      const response = await apiRequest("POST", `/technical/api/inventory/locations/${vesselId}`, {
        locationName: trimmed,
        createdBy: "user",
      });
      const result = await response.json();
      const createdLocation = result?.data ?? result;
      const canonicalName = createdLocation?.locationName || trimmed;

      queryClient.invalidateQueries({
        queryKey: [`/technical/api/inventory/locations/${vesselId}`],
      });

      onChange(canonicalName);
      setIsCreating(false);
      setNewLocationName("");
      setOpen(false);
      toast({ title: "Location created", description: `"${trimmed}" has been added.` });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create location",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateNew();
    }
    if (e.key === "Escape") {
      setIsCreating(false);
      setNewLocationName("");
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setIsCreating(false); setNewLocationName(""); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal h-10 px-3"
          data-testid={testId}
        >
          <span className="truncate text-left flex-1">
            {value || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput placeholder="Search locations..." data-testid={testId ? `${testId}-search` : undefined} />
          <CommandList className="max-h-[144px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>No locations found.</CommandEmpty>
                <CommandGroup heading="Locations">
                  {locations.map((loc) => (
                    <CommandItem
                      key={loc.id}
                      value={loc.locationName}
                      onSelect={() => handleSelect(loc.locationName)}
                      data-testid={testId ? `${testId}-option-${loc.id}` : undefined}
                    >
                      <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="truncate flex-1">{loc.locationName}</span>
                      {value === loc.locationName && (
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
          <CommandSeparator />
          <div className="p-1">
            {isCreating ? (
              <div className="flex items-center gap-2 p-1">
                <Input
                  ref={newLocationInputRef}
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter location name..."
                  className="h-8 text-sm"
                  disabled={isSaving}
                  data-testid={testId ? `${testId}-new-input` : undefined}
                />
                <Button
                  size="sm"
                  className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white shrink-0"
                  onClick={handleCreateNew}
                  disabled={isSaving || !newLocationName.trim()}
                  data-testid={testId ? `${testId}-save-new` : undefined}
                >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer text-green-600 font-medium"
                onClick={(e) => { e.preventDefault(); setIsCreating(true); }}
                data-testid={testId ? `${testId}-create-new` : undefined}
              >
                <Plus className="h-4 w-4" />
                Create New Location
              </button>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
