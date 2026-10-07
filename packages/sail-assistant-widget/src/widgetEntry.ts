/** Bundle entry. The IIFE build exposes `window.SailAssistant`; the ESM build exports the same names. */
export { init, VERSION } from './widgetApi';
export type { WidgetConfig, WidgetHandle } from './widgetApi';
export type { WidgetContext } from './widgetSession';
export type { TokenProvider, TokenRequest } from './widgetTransport';
