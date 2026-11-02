
import React from 'react';
import { MicroFrontendWrapper } from './MicroFrontendWrapper';
import App from '../App';
import './micro-frontend.css';

// Main app export for standalone mode
export { default as App } from '../App';

// Individual component exports for micro frontend consumption

// Wrapper export
export { MicroFrontendWrapper, useMicroFrontendConfig } from './MicroFrontendWrapper';

// Micro frontend bootstrap function
export const bootstrap = (config?: any) => {
  return {
    mount: (element: HTMLElement, mountConfig?: any) => {
      const React = require('react');
      const ReactDOM = require('react-dom/client');
      
      const root = ReactDOM.createRoot(element);
      const finalConfig = { ...config, ...mountConfig, standalone: false };
      
      root.render(
        React.createElement(MicroFrontendWrapper, { config: finalConfig },
          React.createElement(App)
        )
      );
      
      return () => root.unmount();
    },
    
    // Individual component mounting
    mountComponent: (component: string, element: HTMLElement, componentConfig?: any) => {
      const React = require('react');
      const ReactDOM = require('react-dom/client');
      
      const components = {
      };
      
      const Component = components[component as keyof typeof components];
      if (!Component) {
        throw new Error(`Component ${component} not found`);
      }
      
      const root = ReactDOM.createRoot(element);
      const finalConfig = { ...config, ...componentConfig, standalone: false };
      
      root.render(
        React.createElement(MicroFrontendWrapper, { config: finalConfig },
          React.createElement(Component)
        )
      );
      
      return () => root.unmount();
    }
  };
};

// Global registration for micro frontend
if (typeof window !== 'undefined') {
  (window as any).ElementCrewAppraisals = {
    bootstrap,
    MicroFrontendWrapper,
    components: {
      App
    }
  };
}
