import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from 'wouter';
import App from './App';
import './index.css';

// Like Crewing: wouter with base /crewing, React StrictMode (double-mount in dev — the widget must not duplicate).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router base="/crewing">
      <App />
    </Router>
  </StrictMode>,
);
