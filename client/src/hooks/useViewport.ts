import { useState, useEffect, useMemo } from 'react';

export type ViewportType = 'desktop' | 'laptop' | 'tablet' | 'phone';

export interface ViewportConfig {
  useFitColumns: boolean;
  minColumnWidth: number;
  headerHeight: number;
  rowHeight: number;
  showSideBar: boolean;
  showStatusBar: boolean;
  alwaysShowHorizontalScroll: boolean;
  isTabletOrPhone: boolean;
}

const BREAKPOINTS = {
  phone: 480,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
};

export function useViewport(): ViewportType {
  const [viewport, setViewport] = useState<ViewportType>('desktop');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.phone) {
        setViewport('phone');
      } else if (width < BREAKPOINTS.tablet) {
        setViewport('tablet');
      } else if (width < BREAKPOINTS.laptop) {
        setViewport('laptop');
      } else {
        setViewport('desktop');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

export function getViewportConfig(viewport: ViewportType): ViewportConfig {
  switch (viewport) {
    case 'phone':
      return {
        useFitColumns: false,
        minColumnWidth: 100,
        headerHeight: 40,
        rowHeight: 40,
        showSideBar: false,
        showStatusBar: false,
        alwaysShowHorizontalScroll: true,
        isTabletOrPhone: true,
      };
    case 'tablet':
      return {
        useFitColumns: false,
        minColumnWidth: 80,
        headerHeight: 42,
        rowHeight: 42,
        showSideBar: false,
        showStatusBar: true,
        alwaysShowHorizontalScroll: true,
        isTabletOrPhone: true,
      };
    case 'laptop':
      return {
        useFitColumns: true,
        minColumnWidth: 70,
        headerHeight: 44,
        rowHeight: 44,
        showSideBar: true,
        showStatusBar: true,
        alwaysShowHorizontalScroll: false,
        isTabletOrPhone: false,
      };
    case 'desktop':
    default:
      return {
        useFitColumns: true,
        minColumnWidth: 60,
        headerHeight: 46,
        rowHeight: 46,
        showSideBar: true,
        showStatusBar: true,
        alwaysShowHorizontalScroll: false,
        isTabletOrPhone: false,
      };
  }
}

export function useViewportConfig(): ViewportConfig {
  const viewport = useViewport();
  return useMemo(() => getViewportConfig(viewport), [viewport]);
}
