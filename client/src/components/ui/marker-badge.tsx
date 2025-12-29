import { ReactNode } from 'react';
import { useMarkers } from '@/contexts/MarkerContext';

interface MarkerBadgeProps {
  id: string;
  children: ReactNode;
  className?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
}

export function MarkerBadge({ id, children, className = '', position = 'top-left' }: MarkerBadgeProps) {
  const { showMarkers } = useMarkers();

  const positionClasses = {
    'top-left': 'absolute -top-2 -left-2',
    'top-right': 'absolute -top-2 -right-2',
    'bottom-left': 'absolute -bottom-2 -left-2',
    'bottom-right': 'absolute -bottom-2 -right-2',
    'inline': 'inline-flex ml-1'
  };

  return (
    <div className={`relative ${className}`}>
      {children}
      {showMarkers && (
        <span 
          className={`${positionClasses[position]} bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-[9998] whitespace-nowrap pointer-events-none shadow-md`}
          title={id}
        >
          {id}
        </span>
      )}
    </div>
  );
}

export function Marker({ id, className = '' }: { id: string; className?: string }) {
  const { showMarkers } = useMarkers();

  if (!showMarkers) return null;

  return (
    <span 
      className={`bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-[9998] whitespace-nowrap pointer-events-none shadow-md ${className}`}
      title={id}
    >
      {id}
    </span>
  );
}
