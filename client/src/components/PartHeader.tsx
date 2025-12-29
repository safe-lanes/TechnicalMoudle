import { Marker } from "@/components/ui/marker-badge";

interface PartHeaderProps {
  id: string;
  label: string;
  title: string;
  description?: string;
  headerMarker?: string;
  descriptionMarker?: string;
}

export function PartHeader({ id, label, title, description, headerMarker, descriptionMarker }: PartHeaderProps) {
  return (
    <div id={id} className="bg-blue-50 rounded-md border border-blue-100 p-1 mb-4">
      <div className="bg-white rounded-sm px-6 py-4">
        <h1 className="text-lg font-bold text-[hsl(var(--primary))] mb-1" data-testid={headerMarker}>
          {headerMarker && <Marker id={headerMarker} />}
          {label} - {title}
        </h1>
        {description && (
          <p className="text-xs text-gray-600" data-testid={descriptionMarker}>
            {descriptionMarker && <Marker id={descriptionMarker} />}
            {description}
          </p>
        )}
        <div className="mt-3 h-0.5 bg-[hsl(var(--primary))]"></div>
      </div>
    </div>
  );
}
