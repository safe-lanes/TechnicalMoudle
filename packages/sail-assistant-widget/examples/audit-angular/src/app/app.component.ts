import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet, Routes } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SailAssistantService } from './sail-assistant.service';

@Component({ standalone: true, template: `<h1>{{ title }}</h1><p>{{ note }}</p>` })
export class SectionComponent {
  title = '';
  note = '';
  constructor(route: ActivatedRoute) {
    route.data.subscribe((d) => { this.title = d['title']; this.note = d['note']; });
  }
}

// Audit & Safety is ONE SPA with audit / safety / incident sections. Which assistant module each section uses is the
// host's explicit configuration (route data) — the widget never guesses it from the address.
export const ROUTES: Routes = [
  { path: 'audit', component: SectionComponent, data: { assistantModule: 'audit', title: 'Audit — Preparation', note: 'Vessel filter optional.' } },
  { path: 'safety', component: SectionComponent, data: { assistantModule: 'safety', title: 'Safety — MOC', note: 'Vessel filter optional.' } },
  { path: 'incident', component: SectionComponent, data: { assistantModule: 'incident', title: 'Incident — Near Miss', note: 'No starter questions are published for this module in the demo.' } },
  { path: '', pathMatch: 'full', redirectTo: 'audit' },
];

const ASSISTANT_URL = new URLSearchParams(location.search).get('assistant') || 'http://localhost:4802';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="mock-banner" role="note"><strong>DEMO — MOCK identity and MOCK assistant</strong> (Audit &amp; Safety example, Angular 19.2).</div>
    <main>
      <nav>
        <a routerLink="/audit" data-testid="nav-audit">Audit</a>
        <a routerLink="/safety" data-testid="nav-safety">Safety</a>
        <a routerLink="/incident" data-testid="nav-incident">Incident</a>
      </nav>
      <p>
        <span data-testid="who">{{ session ? session.userId + ' @ ' + session.tenant : 'signed out' }}</span>
        <button type="button" (click)="login('301', 'acme')">User A</button>
        <button type="button" (click)="login('402', 'globex')">User B</button>
        <button type="button" data-testid="logout" (click)="logout()">Logout</button>
        <label>Vessel
          <select data-testid="vessel" (change)="pickVessel($any($event.target).value)">
            <option value="">All / none</option>
            <option value="v-11">MT Charlie</option>
            <option value="v-12">MT Delta</option>
          </select>
        </label>
      </p>
      <router-outlet />
    </main>
    <div class="sync-button" title="Sync (host button)"></div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  session: { userId: string; tenant: string; role: string } | null = { userId: '301', tenant: 'acme', role: 'Office Superintendent' };
  private vessel: { id: string; name: string } | null = null;
  private module = 'audit';
  private sub?: Subscription;

  constructor(private assistant: SailAssistantService, private router: Router) {}

  ngOnInit(): void {
    this.assistant.start({
      assistantUrl: ASSISTANT_URL,
      module: this.module,
      title: 'Audit & Safety Assistant',
      offset: 84, // clear the host's fixed sync button at bottom-right
      // Real SAILERP: GET ${environment.serverUrl}/assistant/token — the interceptor adds Authorization: Bearer; the NestJS
      // @Auth() guard verifies the JWT against the token table and the tenant, then mints. Here: a MOCK endpoint.
      getToken: async ({ signal }) => {
        const s = this.session;
        const r = await fetch(`/mock-token/${this.module}`, {
          headers: { Authorization: `Bearer mock-session:${s ? `${s.userId}|${s.tenant}|${s.role}` : ''}` }, signal, cache: 'no-store' });
        if (!r.ok) throw new Error(`token endpoint HTTP ${r.status}`);
        return (await r.json()).token;
      },
      context: this.ctx(),
    });
    this.sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      let r = this.router.routerState.snapshot.root;
      while (r.firstChild) r = r.firstChild;
      const m = r.data['assistantModule'];
      if (typeof m === 'string') this.module = m;
      this.assistant.update(this.ctx());
    });
  }

  private ctx() {
    return {
      module: this.module,
      userKey: this.session ? this.session.userId : null,
      tenantKey: this.session ? this.session.tenant : null,
      vesselId: this.vessel?.id ?? null,
      vesselName: this.vessel?.name ?? null,
      currentPage: this.router.url,
    };
  }

  login(userId: string, tenant: string): void {
    this.session = { userId, tenant, role: 'Office Superintendent' };
    this.assistant.update(this.ctx());
  }

  logout(): void {
    this.session = null;
    this.assistant.update(this.ctx());
  }

  pickVessel(id: string): void {
    const names: Record<string, string> = { 'v-11': 'MT Charlie', 'v-12': 'MT Delta' };
    this.vessel = id ? { id, name: names[id] } : null;
    this.assistant.update(this.ctx());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.assistant.stop();
  }
}
