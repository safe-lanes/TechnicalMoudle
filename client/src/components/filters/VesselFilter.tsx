import { useState } from 'react';
import { Filter, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

type FilterMode = 'vessel' | 'fleet' | 'group';

export interface VesselFilterValue {
  mode: FilterMode;
  selectedVessels: string[];
  selectedFleets: string[];
  selectedGroups: string[];
}

interface VesselOption {
  id: string;
  name: string;
}

interface VesselFilterProps {
  value?: VesselFilterValue;
  onChange: (value: VesselFilterValue) => void;
  vessels?: VesselOption[];
  fleets?: VesselOption[];
  groups?: VesselOption[];
  className?: string;
}

const defaultValue: VesselFilterValue = {
  mode: 'vessel',
  selectedVessels: [],
  selectedFleets: [],
  selectedGroups: [],
};

export const VesselFilter = ({ 
  value = defaultValue, 
  onChange, 
  vessels = [],
  fleets = [],
  groups = [],
  className 
}: VesselFilterProps) => {
  const [vesselDropdownOpen, setVesselDropdownOpen] = useState(false);
  const [fleetDropdownOpen, setFleetDropdownOpen] = useState(false);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  const handleModeChange = (newMode: FilterMode) => {
    onChange({
      ...value,
      mode: newMode,
    });
  };

  const handleVesselSelect = (vesselId: string, checked: boolean) => {
    const newSelectedVessels = checked
      ? [...value.selectedVessels, vesselId]
      : value.selectedVessels.filter(id => id !== vesselId);
    
    onChange({
      ...value,
      selectedVessels: newSelectedVessels,
    });
  };

  const handleFleetSelect = (fleetId: string, checked: boolean) => {
    const newSelectedFleets = checked
      ? [...value.selectedFleets, fleetId]
      : value.selectedFleets.filter(id => id !== fleetId);
    
    onChange({
      ...value,
      selectedFleets: newSelectedFleets,
    });
  };

  const handleGroupSelect = (groupId: string, checked: boolean) => {
    const newSelectedGroups = checked
      ? [...value.selectedGroups, groupId]
      : value.selectedGroups.filter(id => id !== groupId);
    
    onChange({
      ...value,
      selectedGroups: newSelectedGroups,
    });
  };

  const handleClear = () => {
    onChange({
      mode: 'vessel',
      selectedVessels: [],
      selectedFleets: [],
      selectedGroups: [],
    });
  };

  const getVesselDisplayText = () => {
    if (value.selectedVessels.length === 0) return 'Vessel';
    if (value.selectedVessels.length === 1) {
      const vessel = vessels.find(v => v.id === value.selectedVessels[0]);
      return vessel?.name || 'Vessel';
    }
    return `${value.selectedVessels.length} Vessels`;
  };

  const getFleetDisplayText = () => {
    if (value.selectedFleets.length === 0) return 'Fleet';
    if (value.selectedFleets.length === 1) {
      const fleet = fleets.find(f => f.id === value.selectedFleets[0]);
      return fleet?.name || 'Fleet';
    }
    return `${value.selectedFleets.length} Fleets`;
  };

  const getGroupDisplayText = () => {
    if (value.selectedGroups.length === 0) return 'Add Group';
    if (value.selectedGroups.length === 1) {
      const group = groups.find(g => g.id === value.selectedGroups[0]);
      return group?.name || 'Add Group';
    }
    return `${value.selectedGroups.length} Groups`;
  };

  const hasActiveFilters = 
    value.selectedVessels.length > 0 || 
    value.selectedFleets.length > 0 || 
    value.selectedGroups.length > 0;

  return (
    <div className={`flex items-center gap-6 bg-[#1e3a5f] px-4 py-3 ${className}`}>
      <RadioGroup 
        value={value.mode} 
        onValueChange={(val) => handleModeChange(val as FilterMode)}
        className="flex items-center gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem 
            value="vessel" 
            id="filter-vessel" 
            className="border-white text-white data-[state=checked]:bg-white data-[state=checked]:text-[#1e3a5f]"
            data-testid="radio-filter-vessel"
          />
          <Label 
            htmlFor="filter-vessel" 
            className="text-white text-sm font-normal cursor-pointer"
          >
            Vessel
          </Label>

          <Popover open={vesselDropdownOpen} onOpenChange={setVesselDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 w-40 justify-between text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                data-testid="dropdown-vessel"
              >
                <span className="truncate">{getVesselDisplayText()}</span>
                <ChevronDown className="h-3 w-3 ml-2 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start" data-testid="dropdown-vessel-content">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {vessels.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No vessels available</p>
                  ) : (
                    vessels.map((vessel) => (
                      <div 
                        key={vessel.id} 
                        className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => handleVesselSelect(vessel.id, !value.selectedVessels.includes(vessel.id))}
                      >
                        <Checkbox
                          id={`vessel-${vessel.id}`}
                          checked={value.selectedVessels.includes(vessel.id)}
                          onCheckedChange={(checked) => handleVesselSelect(vessel.id, checked as boolean)}
                          data-testid={`checkbox-vessel-${vessel.id}`}
                        />
                        <label 
                          htmlFor={`vessel-${vessel.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {vessel.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <RadioGroupItem 
            value="fleet" 
            id="filter-fleet" 
            className="border-white text-white data-[state=checked]:bg-white data-[state=checked]:text-[#1e3a5f]"
            data-testid="radio-filter-fleet"
          />
          <Label 
            htmlFor="filter-fleet" 
            className="text-white text-sm font-normal cursor-pointer"
          >
            Fleet
          </Label>

          <Popover open={fleetDropdownOpen} onOpenChange={setFleetDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 w-40 justify-between text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                data-testid="dropdown-fleet"
              >
                <span className="truncate">{getFleetDisplayText()}</span>
                <ChevronDown className="h-3 w-3 ml-2 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start" data-testid="dropdown-fleet-content">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {fleets.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No fleets available</p>
                  ) : (
                    fleets.map((fleet) => (
                      <div 
                        key={fleet.id} 
                        className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => handleFleetSelect(fleet.id, !value.selectedFleets.includes(fleet.id))}
                      >
                        <Checkbox
                          id={`fleet-${fleet.id}`}
                          checked={value.selectedFleets.includes(fleet.id)}
                          onCheckedChange={(checked) => handleFleetSelect(fleet.id, checked as boolean)}
                          data-testid={`checkbox-fleet-${fleet.id}`}
                        />
                        <label 
                          htmlFor={`fleet-${fleet.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {fleet.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <RadioGroupItem 
            value="group" 
            id="filter-group" 
            className="border-white text-white data-[state=checked]:bg-white data-[state=checked]:text-[#1e3a5f]"
            data-testid="radio-filter-group"
          />
          <Label 
            htmlFor="filter-group" 
            className="text-white text-sm font-normal cursor-pointer"
          >
            Add Group
          </Label>

          <Popover open={groupDropdownOpen} onOpenChange={setGroupDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 w-40 justify-between text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                data-testid="dropdown-group"
              >
                <span className="truncate">{getGroupDisplayText()}</span>
                <ChevronDown className="h-3 w-3 ml-2 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start" data-testid="dropdown-group-content">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {groups.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No groups available</p>
                  ) : (
                    groups.map((group) => (
                      <div 
                        key={group.id} 
                        className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => handleGroupSelect(group.id, !value.selectedGroups.includes(group.id))}
                      >
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={value.selectedGroups.includes(group.id)}
                          onCheckedChange={(checked) => handleGroupSelect(group.id, checked as boolean)}
                          data-testid={`checkbox-group-${group.id}`}
                        />
                        <label 
                          htmlFor={`group-${group.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {group.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </RadioGroup>

      <Button
        variant="outline"
        onClick={handleClear}
        className="h-8 px-4 text-xs bg-transparent border-white text-white hover:bg-white/10"
        data-testid="button-clear-filters"
      >
        Clear
      </Button>
    </div>
  );
};

interface FiltersToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const FiltersToggle = ({ isOpen, onToggle, className }: FiltersToggleProps) => {
  return (
    <Button
      variant="outline"
      onClick={onToggle}
      className={`h-8 px-3 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50 ${className}`}
      data-testid="button-toggle-filters"
    >
      <Filter className="h-3 w-3 mr-2" />
      Filters
    </Button>
  );
};
