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

// Marker component is now in @/components/Marker.tsx to avoid Vite Fast Refresh issues
