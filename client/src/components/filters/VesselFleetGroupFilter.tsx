import { useState, useMemo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useExternalVessels, useExternalFleetGroups, useExternalAdditionalGroups } from '@/hooks/useExternalMasterData';

type FilterMode = 'vessel' | 'fleet' | 'group';

export interface VesselFleetGroupFilterValue {
  mode: FilterMode;
  selectedVessels: string[];
  selectedFleets: string[];
  selectedGroups: string[];
}

export interface VesselFleetGroupFilterResult extends VesselFleetGroupFilterValue {
  selectedVesselNames: string[];
  selectedFleetNames: string[];
  selectedGroupNames: string[];
}

interface VesselFleetGroupFilterProps {
  value?: VesselFleetGroupFilterValue;
  onChange: (value: VesselFleetGroupFilterResult) => void;
  className?: string;
  showClearButton?: boolean;
}

const defaultValue: VesselFleetGroupFilterValue = {
  mode: 'vessel',
  selectedVessels: [],
  selectedFleets: [],
  selectedGroups: [],
};

const getFieldValue = (entry: any, fieldOptions: string[]): string => {
  for (const field of fieldOptions) {
    if (entry[field] !== undefined && entry[field] !== null) {
      return String(entry[field]);
    }
  }
  return '';
};

export const VesselFleetGroupFilter = ({ 
  value = defaultValue, 
  onChange, 
  className,
  showClearButton = true,
}: VesselFleetGroupFilterProps) => {
  const [vesselDropdownOpen, setVesselDropdownOpen] = useState(false);
  const [fleetDropdownOpen, setFleetDropdownOpen] = useState(false);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  const { data: externalVessels = [], isLoading: vesselsLoading } = useExternalVessels();
  const { data: externalFleetGroups = [], isLoading: fleetsLoading } = useExternalFleetGroups();
  const { data: externalAdditionalGroups = [], isLoading: groupsLoading } = useExternalAdditionalGroups();

  const vesselOptions = useMemo(() => {
    return externalVessels.map((v: any) => ({
      id: getFieldValue(v, ['vuid', 'vesselId', 'id']),
      name: getFieldValue(v, ['vessel', 'vesselName', 'name']),
    })).filter((v: { id: string; name: string }) => v.id && v.name);
  }, [externalVessels]);

  const fleetOptions = useMemo(() => {
    return externalFleetGroups.map((f: any) => ({
      id: getFieldValue(f, ['fleet_group_id', 'fleetGroupId', 'id']),
      name: getFieldValue(f, ['fleet_group_name', 'fleetGroupName', 'name', 'group_name']),
      vessels: getFieldValue(f, ['vessels', 'vesselList', 'vessel_list']),
    })).filter((f: { id: string; name: string }) => f.id && f.name);
  }, [externalFleetGroups]);

  const groupOptions = useMemo(() => {
    return externalAdditionalGroups.map((g: any) => ({
      id: getFieldValue(g, ['id', 'groupId', 'additional_group_id']),
      name: getFieldValue(g, ['group_name', 'groupName', 'name', 'additional_group_name']),
      vessels: getFieldValue(g, ['vessels', 'vesselList', 'vessel_list']),
    })).filter((g: { id: string; name: string }) => g.id && g.name);
  }, [externalAdditionalGroups]);

  const parseVesselNamesFromString = useCallback((vesselsString: string): string[] => {
    if (!vesselsString || vesselsString.trim() === '') return [];
    return vesselsString.split(',').map(v => v.trim()).filter(v => v.length > 0);
  }, []);

  const getVesselNamesForFleets = useCallback((fleetIds: string[]): string[] => {
    if (fleetIds.length === 0) return [];
    const vesselNames: string[] = [];
    fleetIds.forEach(fleetId => {
      const fleet = fleetOptions.find((f: { id: string; name: string; vessels: string }) => f.id === fleetId);
      if (fleet && fleet.vessels) {
        const names = parseVesselNamesFromString(fleet.vessels);
        vesselNames.push(...names);
      }
    });
    return [...new Set(vesselNames)];
  }, [fleetOptions, parseVesselNamesFromString]);

  const getVesselNamesForGroups = useCallback((groupIds: string[]): string[] => {
    if (groupIds.length === 0) return [];
    const vesselNames: string[] = [];
    groupIds.forEach(groupId => {
      const group = groupOptions.find((g: { id: string; name: string; vessels: string }) => g.id === groupId);
      if (group && group.vessels) {
        const names = parseVesselNamesFromString(group.vessels);
        vesselNames.push(...names);
      }
    });
    return [...new Set(vesselNames)];
  }, [groupOptions, parseVesselNamesFromString]);

  const deriveResult = useCallback((newValue: VesselFleetGroupFilterValue): VesselFleetGroupFilterResult => {
    const directVesselNames = newValue.selectedVessels
      .map(id => vesselOptions.find((v: { id: string; name: string }) => v.id === id)?.name)
      .filter((name): name is string => !!name);
    
    const selectedFleetNames = newValue.selectedFleets
      .map(id => fleetOptions.find((f: { id: string; name: string }) => f.id === id)?.name)
      .filter((name): name is string => !!name);
    
    const selectedGroupNames = newValue.selectedGroups
      .map(id => groupOptions.find((g: { id: string; name: string }) => g.id === id)?.name)
      .filter((name): name is string => !!name);

    let selectedVesselNames: string[];
    switch (newValue.mode) {
      case 'fleet':
        selectedVesselNames = getVesselNamesForFleets(newValue.selectedFleets);
        break;
      case 'group':
        selectedVesselNames = getVesselNamesForGroups(newValue.selectedGroups);
        break;
      case 'vessel':
      default:
        selectedVesselNames = directVesselNames;
        break;
    }

    return {
      ...newValue,
      selectedVesselNames,
      selectedFleetNames,
      selectedGroupNames,
    };
  }, [vesselOptions, fleetOptions, groupOptions, getVesselNamesForFleets, getVesselNamesForGroups]);

  const handleModeChange = (newMode: FilterMode) => {
    const newValue = { ...value, mode: newMode };
    onChange(deriveResult(newValue));
  };

  const handleVesselSelect = (vesselId: string, checked: boolean) => {
    const newSelectedVessels = checked
      ? [...value.selectedVessels, vesselId]
      : value.selectedVessels.filter(id => id !== vesselId);
    
    const newValue = { ...value, selectedVessels: newSelectedVessels };
    onChange(deriveResult(newValue));
  };

  const handleFleetSelect = (fleetId: string, checked: boolean) => {
    const newSelectedFleets = checked
      ? [...value.selectedFleets, fleetId]
      : value.selectedFleets.filter(id => id !== fleetId);
    
    const newValue = { ...value, selectedFleets: newSelectedFleets };
    onChange(deriveResult(newValue));
  };

  const handleGroupSelect = (groupId: string, checked: boolean) => {
    const newSelectedGroups = checked
      ? [...value.selectedGroups, groupId]
      : value.selectedGroups.filter(id => id !== groupId);
    
    const newValue = { ...value, selectedGroups: newSelectedGroups };
    onChange(deriveResult(newValue));
  };

  const handleClear = () => {
    const newValue = {
      mode: 'vessel' as FilterMode,
      selectedVessels: [],
      selectedFleets: [],
      selectedGroups: [],
    };
    onChange(deriveResult(newValue));
  };

  const getVesselDisplayText = () => {
    if (value.selectedVessels.length === 0) return 'Vessel';
    if (value.selectedVessels.length === 1) {
      const vessel = vesselOptions.find((v: { id: string; name: string }) => v.id === value.selectedVessels[0]);
      return vessel?.name || 'Vessel';
    }
    return `${value.selectedVessels.length} Vessels`;
  };

  const getFleetDisplayText = () => {
    if (value.selectedFleets.length === 0) return 'Fleet';
    if (value.selectedFleets.length === 1) {
      const fleet = fleetOptions.find((f: { id: string; name: string }) => f.id === value.selectedFleets[0]);
      return fleet?.name || 'Fleet';
    }
    return `${value.selectedFleets.length} Fleets`;
  };

  const getGroupDisplayText = () => {
    if (value.selectedGroups.length === 0) return 'Add Group';
    if (value.selectedGroups.length === 1) {
      const group = groupOptions.find((g: { id: string; name: string }) => g.id === value.selectedGroups[0]);
      return group?.name || 'Add Group';
    }
    return `${value.selectedGroups.length} Groups`;
  };

  return (
    <div className={`flex items-center gap-4 ${className || ''}`}>
      <RadioGroup 
        value={value.mode} 
        onValueChange={(val) => handleModeChange(val as FilterMode)}
        className="flex items-center gap-4"
      >
        <div className="flex items-center gap-1">
          <RadioGroupItem 
            value="vessel" 
            id="filter-vessel" 
            className="border-gray-400 text-gray-700 data-[state=checked]:bg-gray-700 data-[state=checked]:text-white"
            data-testid="radio-filter-vessel"
          />
          <Popover open={vesselDropdownOpen} onOpenChange={setVesselDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 w-32 justify-between text-xs bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100"
                data-testid="dropdown-vessel"
              >
                <span className="truncate">{getVesselDisplayText()}</span>
                <ChevronDown className="h-3 w-3 ml-2 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start" data-testid="dropdown-vessel-content">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {vesselsLoading ? (
                    <p className="text-sm text-gray-500 p-2">Loading vessels...</p>
                  ) : vesselOptions.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No vessels available</p>
                  ) : (
                    vesselOptions.map((vessel: { id: string; name: string }) => (
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

        <div className="flex items-center gap-1">
          <RadioGroupItem 
            value="fleet" 
            id="filter-fleet" 
            className="border-gray-400 text-gray-700 data-[state=checked]:bg-gray-700 data-[state=checked]:text-white"
            data-testid="radio-filter-fleet"
          />
          <Popover open={fleetDropdownOpen} onOpenChange={setFleetDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 w-32 justify-between text-xs bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100"
                data-testid="dropdown-fleet"
              >
                <span className="truncate">{getFleetDisplayText()}</span>
                <ChevronDown className="h-3 w-3 ml-2 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start" data-testid="dropdown-fleet-content">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {fleetsLoading ? (
                    <p className="text-sm text-gray-500 p-2">Loading fleets...</p>
                  ) : fleetOptions.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No fleets available</p>
                  ) : (
                    fleetOptions.map((fleet: { id: string; name: string }) => (
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

        <div className="flex items-center gap-1">
          <RadioGroupItem 
            value="group" 
            id="filter-group" 
            className="border-gray-400 text-gray-700 data-[state=checked]:bg-gray-700 data-[state=checked]:text-white"
            data-testid="radio-filter-group"
          />
          <Popover open={groupDropdownOpen} onOpenChange={setGroupDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 w-32 justify-between text-xs bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100"
                data-testid="dropdown-group"
              >
                <span className="truncate">{getGroupDisplayText()}</span>
                <ChevronDown className="h-3 w-3 ml-2 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start" data-testid="dropdown-group-content">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {groupsLoading ? (
                    <p className="text-sm text-gray-500 p-2">Loading groups...</p>
                  ) : groupOptions.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No groups available</p>
                  ) : (
                    groupOptions.map((group: { id: string; name: string }) => (
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

      {showClearButton && (
        <Button
          variant="outline"
          onClick={handleClear}
          className="h-8 px-4 text-xs bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100"
          data-testid="button-clear-filters"
        >
          Clear
        </Button>
      )}
    </div>
  );
};

export const createDefaultFilterValue = (): VesselFleetGroupFilterValue => ({
  mode: 'vessel',
  selectedVessels: [],
  selectedFleets: [],
  selectedGroups: [],
});
