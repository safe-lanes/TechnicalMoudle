import { Marker } from "@/components/Marker";

interface PartHeaderProps {
  id: string;
  label: string;
  title: string;
  description?: string;
  headerMarker?: string;
  descriptionMarker?: string;
  variant?: 'card' | 'inline';
}

export function PartHeader({ id, label, title, description, headerMarker, descriptionMarker, variant = 'card' }: PartHeaderProps) {
  const isCard = variant === 'card';

  return (
    <div id={id} className={isCard ? "bg-white border border-gray-200 shadow-sm rounded-lg mb-4" : ""}>
      <div className={isCard ? "px-6 py-4" : ""}>
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
    </div>
  );
}
