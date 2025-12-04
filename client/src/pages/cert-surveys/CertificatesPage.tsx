import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VesselFilter, FiltersToggle, VesselFilterValue } from '@/components/filters/VesselFilter';
import type { Vessel, Fleet } from '@shared/schema';

const defaultFilterValue: VesselFilterValue = {
  mode: 'vessel',
  selectedVessels: [],
  selectedFleets: [],
  selectedGroups: [],
};

export default function CertificatesPage() {
  const [showFilters, setShowFilters] = useState(true);
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
        <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
        <div className="flex items-center gap-2">
          <FiltersToggle 
            isOpen={showFilters} 
            onToggle={() => setShowFilters(!showFilters)} 
          />
          <Button
            className="h-8 px-3 text-xs bg-[#0891b2] hover:bg-[#0e7490] text-white"
            data-testid="button-new-certificate"
          >
            <Plus className="h-3 w-3 mr-1" />
            New Cert./ Doc
          </Button>
        </div>
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
    </div>
  );
}
