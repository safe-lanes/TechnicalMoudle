// Minimal typing for the TEST-ONLY jsdom dependency (no @types/jsdom; the package declares no dependencies of its own).
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string; pretendToBeVisual?: boolean });
    readonly window: Window & typeof globalThis;
  }
}
