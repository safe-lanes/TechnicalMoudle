/**
 * Gives a Node test a browser-like global scope (window, document, HTMLElement, …) from jsdom, so the widget's public
 * API can be mounted and inspected without a browser. Import this module BEFORE any widget module: react-dom decides
 * at import time whether a DOM exists.
 *
 * jsdom is a TEST-ONLY dependency that the package does not declare (it has no dependencies of its own; it builds and
 * tests with the repository's root node_modules). Install it untracked, inside this package:
 *   npm install --no-save --no-package-lock jsdom
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://host.example/app', pretendToBeVisual: true });
const win = dom.window as unknown as Record<string, unknown>;
const g = globalThis as unknown as Record<string, unknown>;

// Node already has fetch, Response, AbortController, DOMException, MessageChannel, crypto, atob, URL, timers … — keep
// those; copy everything jsdom adds (window, document, the element classes, events, getComputedStyle, …).
for (const key of Object.getOwnPropertyNames(win)) {
  if (key in g) continue;
  Object.defineProperty(g, key, { configurable: true, writable: true, value: win[key] });
}
g.window = dom.window;
g.IS_REACT_ACT_ENVIRONMENT = true; // React's act() flushes renders synchronously in tests

export const jsdomWindow = dom.window;
