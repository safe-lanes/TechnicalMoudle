interface SectionBlockProps {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionBlock({ id, title, description, children, className = '' }: SectionBlockProps) {
  return (
    <section id={id} className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div className="border-l-4 border-[hsl(var(--section-accent))] px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="px-6 py-4">
        {children}
      </div>
    </section>
  );
}
