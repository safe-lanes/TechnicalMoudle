import { useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { useSailAssistant } from './useSailAssistant';

const ASSISTANT_URL = new URLSearchParams(location.search).get('assistant') || 'http://localhost:4802';
const VESSELS = [{ id: 'v-101', name: 'MV Alpha' }, { id: 'v-202', name: 'MV Bravo' }];

// MOCK login state. In Crewing the parent SAILERP login fills sessionStorage 'credentials' (encrypted JWT) and
// localStorage 'userProfile'; tenantFetch adds Authorization + x-tenant-id to /api calls.
type Session = { userId: string; tenant: string; role: string } | null;

export default function App() {
  const [session, setSession] = useState<Session>({ userId: '101', tenant: 'acme', role: 'Crew Manager' });
  const [vesselId, setVesselId] = useState<string | null>(null);
  const [location] = useLocation();
  const vessel = VESSELS.find((v) => v.id === vesselId) ?? null;
  // Crewing has no global vessel: only Rest Hours uses one here. Elsewhere the widget runs without vessel context.
  const onRestHours = location.startsWith('/rest-hours');

  useSailAssistant({
    enabled: true,
    assistantUrl: ASSISTANT_URL,
    module: 'crewing', // the CONFIGURED module id — never derived from the URL
    title: 'Crewing Assistant',
    // Real Crewing: fetch('/crewing/api/v2/assistant/token') — tenantFetch attaches the Bearer token + x-tenant-id; the
    // server verifies the JWT and mints. Here: a MOCK endpoint.
    getToken: async ({ signal }) => {
      const r = await fetch('/mock-token/crewing', {
        headers: { Authorization: `Bearer mock-session:${session ? `${session.userId}|${session.tenant}|${session.role}` : ''}` },
        signal,
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`token endpoint HTTP ${r.status}`);
      return (await r.json()).token;
    },
    context: {
      userKey: session ? session.userId : null,
      tenantKey: session ? session.tenant : null,
      vesselId: onRestHours ? vessel?.id ?? null : null,
      vesselName: onRestHours ? vessel?.name ?? null : null,
      currentPage: location,
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center gap-4 bg-white px-6 py-3 shadow">
        <strong>Crewing (example)</strong>
        <nav className="flex gap-3 text-sm">
          <Link href="/crew-list" className="text-blue-700 underline">Crew list</Link>
          <Link href="/rest-hours" className="text-blue-700 underline">Rest hours</Link>
        </nav>
        <span className="ml-auto text-sm" data-testid="who">{session ? `${session.userId} @ ${session.tenant}` : 'signed out'}</span>
        <button className="rounded bg-slate-800 px-3 py-1 text-white" onClick={() => setSession({ userId: '101', tenant: 'acme', role: 'Crew Manager' })}>User A</button>
        <button className="rounded bg-slate-800 px-3 py-1 text-white" onClick={() => setSession({ userId: '202', tenant: 'globex', role: 'Crew Manager' })}>User B</button>
        <button className="rounded bg-red-700 px-3 py-1 text-white" onClick={() => setSession(null)}>Logout</button>
      </header>
      <div className="m-6 rounded border border-amber-500 bg-amber-100 p-3 text-sm" role="note">
        <strong>DEMO — MOCK identity and MOCK assistant</strong> unless <code>?assistant=</code> points at a pilot.
      </div>
      <main className="px-6">
        <Switch>
          <Route path="/rest-hours">
            <h1 className="text-xl font-semibold">Rest hours</h1>
            <label className="mt-3 block">Vessel{' '}
              <select data-testid="vessel" className="border" value={vesselId ?? ''} onChange={(e) => setVesselId(e.target.value || null)}>
                <option value="">— select —</option>
                {VESSELS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          </Route>
          <Route>
            <h1 className="text-xl font-semibold">Crew list</h1>
            <p className="mt-2 text-sm text-slate-600">No vessel context on this page.</p>
            <button className="mt-3 rounded bg-blue-700 px-3 py-1 text-white" data-testid="host-button">Host button</button>
          </Route>
        </Switch>
      </main>
      <div className="toaster-like" aria-hidden="true" />
    </div>
  );
}
