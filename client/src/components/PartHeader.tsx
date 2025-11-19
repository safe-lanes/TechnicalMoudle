interface PartHeaderProps {
  id: string;
  label: string;
  title: string;
  description?: string;
}

export function PartHeader({ id, label, title, description }: PartHeaderProps) {
  return (
    <div id={id} className="bg-blue-50 rounded-md px-6 py-5 mb-4">
      <h1 className="text-lg font-bold text-[hsl(var(--primary))] mb-1">
        {label} - {title}
      </h1>
      {description && (
        <p className="text-xs text-gray-600">{description}</p>
      )}
      <div className="mt-4 h-0.5 bg-[hsl(var(--primary))]"></div>
    </div>
  );
}
