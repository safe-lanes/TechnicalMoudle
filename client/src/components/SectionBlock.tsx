import { Marker } from "@/components/Marker";

interface SectionBlockProps {
  id?: string;
  number?: string;
  title: string;
  description?: string;
  headerMarker?: string;
  descriptionMarker?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: 'card' | 'inline';
}

export function SectionBlock({ id, number, title, description, headerMarker, descriptionMarker, headerActions, children, className = '', variant = 'card' }: SectionBlockProps) {
  const isCard = variant === 'card';

  return (
    <section id={id} className={isCard ? `bg-white border border-gray-200 shadow-sm rounded-lg ${className}` : className}>
      <div className={isCard ? "px-6 pt-4 pb-3" : "pb-3"}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#16569e] flex items-start gap-1.5" data-testid={headerMarker}>
            {headerMarker && <Marker id={headerMarker} />}
            {number && <span>{number}.</span>}
            <span>{title}</span>
          </h3>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-600 mt-1 ml-6" data-testid={descriptionMarker}>
            {descriptionMarker && <Marker id={descriptionMarker} />}
            {description}
          </p>
        )}
        <div className="mt-2 h-0.5 bg-[#16569e]"></div>
      </div>
      <div className={isCard ? "px-6 py-4" : "py-4"}>
        {children}
      </div>
    </section>
  );
}
