import { Marker } from "@/components/Marker";

interface PartHeaderProps {
  id: string;
  label: string;
  title: string;
  description?: string;
  headerMarker?: string;
  descriptionMarker?: string;
  variant?: 'default' | 'inline';
}

export function PartHeader({ id, label, title, description, headerMarker, descriptionMarker, variant = 'default' }: PartHeaderProps) {
  if (variant === 'inline') {
    return (
      <div id={id}>
        <h1 className="text-xl font-semibold text-[#1e3a5f] mb-1" data-testid={headerMarker}>
          {headerMarker && <Marker id={headerMarker} />}
          {label} - {title}
        </h1>
        {description && (
          <p className="text-sm text-gray-500 mt-1" data-testid={descriptionMarker}>
            {descriptionMarker && <Marker id={descriptionMarker} />}
            {description}
          </p>
        )}
        <div className="mt-3 h-0.5 bg-blue-500"></div>
      </div>
    );
  }

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
