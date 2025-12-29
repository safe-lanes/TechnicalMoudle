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
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
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
  
  return (
    <span 
      className="inline-flex items-center justify-center bg-purple-600 text-white text-[10px] font-bold px-1 py-0.5 rounded mr-1 align-middle shadow-md border border-purple-400"
      style={{ 
        zIndex: 9998,
        position: 'relative',
        minWidth: 'fit-content',
        whiteSpace: 'nowrap'
      }}
    >
      {id}
    </span>
  );
}
