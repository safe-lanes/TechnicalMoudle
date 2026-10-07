// Host-side glue for an Angular module (copy into the module). The widget is the pinned <script> bundle in index.html;
// Angular never compiles or bundles it.
import { Injectable, NgZone, OnDestroy } from '@angular/core';

export interface AssistantContext {
  module?: string;
  vesselId?: string | null;
  vesselName?: string | null;
  userKey?: string | null;
  tenantKey?: string | null;
  currentPage?: string | null;
}
interface Handle { updateContext(c: AssistantContext): void; open(): void; close(): void; destroy(): void; version: string }
declare global {
  interface Window { SailAssistant?: { init(config: Record<string, unknown>): Handle; VERSION: string } }
}

@Injectable({ providedIn: 'root' })
export class SailAssistantService implements OnDestroy {
  private handle: Handle | null = null;
  constructor(private zone: NgZone) {}

  /** Mount once (e.g. from the shell component after login). Runs outside Angular so the widget's own network and timer
   *  work never triggers change detection in the host. */
  start(config: { assistantUrl: string; module: string; getToken: (r: { forceRefresh: boolean; signal: AbortSignal }) => Promise<string>;
                  context: AssistantContext; title?: string; offset?: number }): void {
    if (this.handle || !window.SailAssistant) return; // not loaded (e.g. offline/ship build) → no widget, no error
    this.handle = this.zone.runOutsideAngular(() => window.SailAssistant!.init({ ...config }));
  }

  update(ctx: AssistantContext): void {
    this.zone.runOutsideAngular(() => this.handle?.updateContext(ctx));
  }

  stop(): void {
    this.handle?.destroy();
    this.handle = null;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
