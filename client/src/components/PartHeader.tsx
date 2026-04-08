import { Marker } from "@/components/Marker";

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
