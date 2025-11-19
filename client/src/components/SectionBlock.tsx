interface SectionBlockProps {
  id?: string;
  number?: string;  // A1, A2, B1, etc.
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionBlock({ id, number, title, description, children, className = '' }: SectionBlockProps) {
  return (
    <section id={id} className={`bg-blue-50 rounded-md border border-gray-200 ${className}`}>
      <div className="px-6 py-4">
        <h2 className="text-sm font-bold text-[hsl(var(--primary))] flex items-start gap-1.5">
          {number && <span>{number}.</span>}
          <span>{title}</span>
        </h2>
        {description && <p className="text-xs text-gray-600 mt-1 ml-6">{description}</p>}
        <div className="mt-2 h-0.5 bg-[hsl(var(--primary))]"></div>
      </div>
      <div className="px-6 py-4 bg-white rounded-b-md">
        {children}
      </div>
    </section>
  );
}
