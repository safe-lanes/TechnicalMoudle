import { useMarkers } from "@/contexts/MarkerContext";

export function Marker({ id }: { id: string }) {
  const { showMarkers } = useMarkers();
  
  if (!showMarkers) return null;
  
  const markerStyle: React.CSSProperties = {
    display: 'inline-block',
    backgroundColor: '#9333ea',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '6px',
    marginRight: '6px',
    verticalAlign: 'middle',
    boxShadow: '0 3px 6px rgba(0,0,0,0.4), 0 0 0 2px #c084fc',
    zIndex: 99999,
    position: 'relative' as const,
    minWidth: 'max-content',
    whiteSpace: 'nowrap' as const,
    lineHeight: 1.2,
    letterSpacing: '0.5px',
    fontFamily: '"Roboto", monospace',
    textShadow: '0 1px 1px rgba(0,0,0,0.3)',
  };
  
  return (
    <span 
      data-marker-id={id}
      data-testid={`marker-${id}`}
      style={markerStyle}
    >
      {id}
    </span>
  );
}
