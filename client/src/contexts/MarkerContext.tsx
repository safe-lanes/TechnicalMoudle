import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface MarkerContextType {
  showMarkers: boolean;
  toggleMarkers: () => void;
}

const MarkerContext = createContext<MarkerContextType | undefined>(undefined);

export function MarkerProvider({ children }: { children: ReactNode }) {
  const [showMarkers, setShowMarkers] = useState(false);

  const toggleMarkers = useCallback(() => {
    setShowMarkers(prev => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        console.log('[MarkerContext] Ctrl+M pressed, toggling markers');
        toggleMarkers();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMarkers]);

  return (
    <MarkerContext.Provider value={{ showMarkers, toggleMarkers }}>
      {children}
      {showMarkers && (
        <div className="fixed bottom-4 right-4 bg-purple-600 text-white px-3 py-2 rounded-lg shadow-lg z-[9999] text-sm font-medium">
          Markers ON (Ctrl+M to toggle)
        </div>
      )}
    </MarkerContext.Provider>
  );
}

export function useMarkers() {
  const context = useContext(MarkerContext);
  if (context === undefined) {
    throw new Error('useMarkers must be used within a MarkerProvider');
  }
  return context;
}

export function Marker({ id }: { id: string }) {
  const { showMarkers } = useMarkers();
  
  if (!showMarkers) return null;
  
  // Using completely inline styles to avoid any CSS compilation issues
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
    fontFamily: 'Inter, system-ui, sans-serif',
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
