import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VesselFilter, FiltersToggle, VesselFilterValue } from '@/components/filters/VesselFilter';
import type { Vessel, Fleet } from '@shared/schema';

const defaultFilterValue: VesselFilterValue = {
  mode: 'vessel',
  selectedVessels: [],
  selectedFleets: [],
  selectedGroups: [],
};

export default function SurveysPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [filterValue, setFilterValue] = useState<VesselFilterValue>(defaultFilterValue);

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ['/api/vessels'],
  });

  const { data: fleets = [] } = useQuery<Fleet[]>({
    queryKey: ['/api/fleets'],
  });

  const vesselOptions = vessels.map(v => ({ id: v.id, name: v.name }));
  const fleetOptions = fleets.map(f => ({ id: f.id, name: f.name }));
  const groupOptions: { id: string; name: string }[] = [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
        <FiltersToggle 
          isOpen={showFilters} 
          onToggle={() => setShowFilters(!showFilters)} 
        />
      </div>

      {showFilters && (
        <VesselFilter
          value={filterValue}
          onChange={setFilterValue}
          vessels={vesselOptions}
          fleets={fleetOptions}
          groups={groupOptions}
        />
      )}

      <div className="px-6 py-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-600">
            Surveys content will be displayed here.
          </p>
          {(filterValue.selectedVessels.length > 0 || 
            filterValue.selectedFleets.length > 0 || 
            filterValue.selectedGroups.length > 0) && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Active Filters:</strong>
                {filterValue.selectedVessels.length > 0 && (
                  <span className="ml-2">
                    Vessels: {filterValue.selectedVessels.join(', ')}
                  </span>
                )}
                {filterValue.selectedFleets.length > 0 && (
                  <span className="ml-2">
                    Fleets: {filterValue.selectedFleets.join(', ')}
                  </span>
                )}
                {filterValue.selectedGroups.length > 0 && (
                  <span className="ml-2">
                    Groups: {filterValue.selectedGroups.join(', ')}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
