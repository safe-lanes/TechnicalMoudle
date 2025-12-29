import { Marker } from "@/components/ui/marker-badge";

interface SectionBlockProps {
  id?: string;
  number?: string;  // A1, A2, B1, etc.
  title: string;
  description?: string;
  headerMarker?: string;
  descriptionMarker?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionBlock({ id, number, title, description, headerMarker, descriptionMarker, children, className = '' }: SectionBlockProps) {
  return (
    <section id={id} className={`bg-blue-50 rounded-md border border-blue-100 p-1 ${className}`}>
      <div className="bg-white rounded-t-sm px-6 py-3">
        <h2 className="text-sm font-bold text-[hsl(var(--primary))] flex items-start gap-1.5" data-testid={headerMarker}>
          {headerMarker && <Marker id={headerMarker} />}
          {number && <span>{number}.</span>}
          <span>{title}</span>
        </h2>
        {description && (
          <p className="text-xs text-gray-600 mt-1 ml-6" data-testid={descriptionMarker}>
            {descriptionMarker && <Marker id={descriptionMarker} />}
            {description}
          </p>
        )}
        <div className="mt-2 h-0.5 bg-[hsl(var(--primary))]"></div>
      </div>
      <div className="px-6 py-4 bg-white rounded-b-sm">
        {children}
      </div>
    </section>
  );
}
