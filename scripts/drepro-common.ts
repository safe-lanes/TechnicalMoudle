/** Shared helpers for the D1–D4 defect-reproduction harnesses (pilot only). */
import { execSync } from 'child_process';
import { Pool } from 'pg';

export const SHIP = 'http://localhost:5100/technical/api';
export const SHORE = 'http://localhost:5000/technical/api';
export const V = '743ef9d1-841a-11ed-aa7c-7003bca91a86'; // WK Frontier Pilot
export const TAG = 'DREPRO';
export const shorePool = new Pool({ connectionString: 'postgres://postgres:admin123@localhost:5432/pms_arch' });

export type Who = { id: string; name: string; role: string; rank: string };
export const CE: Who = { id: 'drepro-user-ce', name: 'DREPRO Chief Engineer', role: 'Chief Engineer', rank: 'Chief Engineer' };
export const THIRD: Who = { id: 'drepro-user-3e', name: 'DREPRO Third Engineer', role: 'Third Engineer', rank: 'Third Engineer' };
export const OFFICE: Who = { id: 'drepro-user-office', name: 'DREPRO Office Reviewer', role: 'Office', rank: 'Technical Superintendent' };

export const log = (...a: any[]) => console.log(...a);
export const hr = (t: string) => console.log(`\n${'─'.repeat(8)} ${t} ${'─'.repeat(Math.max(0, 90 - t.length))}`);

export async function api(base: string, method: string, path: string, body?: any, who: Who = CE) {
  const url = `${base}${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-rank': who.rank,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  const side = base === SHIP ? 'SHIP ' : 'SHORE';
  log(`→ ${side} ${method} ${path}  as ${who.role}${body !== undefined ? '\n   body: ' + JSON.stringify(body).slice(0, 400) : ''}`);
  log(`← ${r.status}  ${text.slice(0, 500).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}

export function shipSql(sql: string): string {
  // SQL via stdin — no shell quoting (Windows execSync goes through cmd.exe).
  return execSync(`docker exec -i pms-ship su postgres -c "psql -d pms_arch_ship -tA"`, { encoding: 'utf8', input: sql + '\n' }).trim();
}
export function shipRows(sql: string): string[] { const out = shipSql(sql); return out ? out.split('\n') : []; }
export async function shoreSql(sql: string): Promise<any[]> { return (await shorePool.query(sql)).rows; }

export async function syncShip(label = 'sync') {
  const r = await api(SHIP, 'POST', '/sync/trigger', { vesselId: V });
  const j = r.json || {};
  log(`   ${label}: pushed=${j.recordsPushed} pulled=${j.recordsPulled} remainPush=${j.remainingPush} remainPull=${j.remainingPull} ok=${j.success}`);
  return j;
}

export const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
