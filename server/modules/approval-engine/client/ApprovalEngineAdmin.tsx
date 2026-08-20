/**
 * Approval Engine — generic admin screen v1 (design v3 §B6). Lives in the engine folder's
 * client area; imports ONLY react (import boundary). A host app routes it wherever it wants
 * and may pass a basePath; all data comes from the engine HTTP API. No product strings here.
 *
 * v1 = Sahil's step-by-step builder: pick a scope from the registry tree → per classification
 * add step rows (Select Approver → AND/OR → next row) → tick to save (a new active version).
 * Mode selector shows 'advanced' disabled ("coming soon"). Per-scope enable/disable toggle.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface Props { basePath?: string; }
type Tree = { modules: Array<{ moduleId: string; label: string; scopes: Array<{ screenId: string; actionId: string; label: string; classifications: { id: string; label: string }[] }> }> };
type Role = { roleId: string; roleLabel: string };
type StepRow = { roles: Role[]; rule: 'all' | 'any' };
type WorkflowSummary = { wfuuid: string; classification: string; label: string; version: number; status: string; createdAt: string };

const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', padding: 16, display: 'flex', gap: 16 },
  col: { border: '1px solid #d0d5dd', borderRadius: 8, padding: 12, minWidth: 260 },
  h: { fontWeight: 600, marginBottom: 8 },
  item: { padding: '6px 8px', borderRadius: 6, cursor: 'pointer' },
  sel: { background: '#eef4ff' },
  btn: { padding: '6px 12px', borderRadius: 6, border: '1px solid #98a2b3', background: '#fff', cursor: 'pointer' },
  primary: { background: '#2e90fa', color: '#fff', border: '1px solid #2e90fa' },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  row: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  chip: { background: '#f2f4f7', borderRadius: 12, padding: '2px 10px', fontSize: 13 },
  err: { color: '#b42318', marginTop: 8 },
  ok: { color: '#067647', marginTop: 8 },
};

export default function ApprovalEngineAdmin({ basePath = '/approval-engine' }: Props) {
  const api = useCallback(async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${basePath}${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    return json;
  }, [basePath]);

  const [tree, setTree] = useState<Tree | null>(null);
  const [moduleId, setModuleId] = useState<string>('');
  const [scopeKeySel, setScopeKeySel] = useState<string>('');
  const [classification, setClassification] = useState<string>('');
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rows, setRows] = useState<StepRow[]>([]);
  const [versions, setVersions] = useState<WorkflowSummary[]>([]);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  useEffect(() => { api('GET', '/registry').then(setTree).catch((e) => setMsg({ err: String(e.message) })); }, [api]);

  const mod = useMemo(() => tree?.modules.find((m) => m.moduleId === moduleId), [tree, moduleId]);
  const scope = useMemo(() => mod?.scopes.find((s) => `${s.screenId}/${s.actionId}` === scopeKeySel), [mod, scopeKeySel]);
  const scopeQuery = scope ? `moduleId=${encodeURIComponent(moduleId)}&screenId=${encodeURIComponent(scope.screenId)}&actionId=${encodeURIComponent(scope.actionId)}` : '';
  const scopeDto = scope ? { moduleId, screenId: scope.screenId, actionId: scope.actionId } : null;

  useEffect(() => {
    if (!scope) return;
    setRows([]); setMsg({});
    api('GET', `/roles?${scopeQuery}`).then(setRoles).catch((e) => setMsg({ err: String(e.message) }));
    api('GET', `/scopes/enabled?${scopeQuery}`).then((r) => setEnabled(!!r.enabled)).catch(() => setEnabled(true));
    api('GET', `/workflows?${scopeQuery}`).then(setVersions).catch(() => setVersions([]));
  }, [api, scopeQuery, scope]);

  const addRow = () => setRows((r) => [...r, { roles: [], rule: 'all' }]);
  const setRowRole = (i: number, roleId: string) => {
    const role = roles.find((r) => r.roleId === roleId);
    if (!role) return;
    setRows((rs) => rs.map((r, idx) => idx !== i || r.roles.some((x) => x.roleId === roleId) ? r : { ...r, roles: [...r.roles, role] }));
  };
  const removeRole = (i: number, roleId: string) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, roles: r.roles.filter((x) => x.roleId !== roleId) } : r));
  const setRule = (i: number, rule: 'all' | 'any') => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, rule } : r)));

  const save = async () => {
    if (!scopeDto || !classification) return;
    setMsg({});
    const steps = rows.filter((r) => r.roles.length > 0);
    const nodes = steps.map((r, i) => ({
      key: `step-${i + 1}`, type: 'approval-step', label: `Step ${i + 1}`, ordinal: i,
      quorum: { rule: r.rule }, slots: r.roles.map((x) => ({ roleId: x.roleId, roleLabel: x.roleLabel })),
    }));
    const all = [...nodes, { key: 'end', type: 'end', label: 'End', ordinal: nodes.length }];
    const edges = all.slice(0, -1).map((n, i) => ({ from: n.key, to: all[i + 1].key }));
    try {
      const saved = await api('POST', '/workflows', { scope: scopeDto, classification, mode, label: `v-next`, nodes: all, edges });
      setMsg({ ok: `Saved as version ${saved.version} (active).` });
      api('GET', `/workflows?${scopeQuery}`).then(setVersions).catch(() => undefined);
      setRows([]);
    } catch (e: any) { setMsg({ err: String(e.message) }); }
  };
  const toggleEnabled = async () => {
    if (!scopeDto) return;
    try { const r = await api('PUT', '/scopes/enabled', { scope: scopeDto, enabled: !enabled }); setEnabled(!!r.enabled); }
    catch (e: any) { setMsg({ err: String(e.message) }); }
  };

  return (
    <div style={S.page}>
      <div style={S.col}>
        <div style={S.h}>Modules</div>
        {tree?.modules.map((m) => (
          <div key={m.moduleId} style={{ ...S.item, ...(m.moduleId === moduleId ? S.sel : {}) }}
            onClick={() => { setModuleId(m.moduleId); setScopeKeySel(''); setClassification(''); }}>
            {m.label}
          </div>
        ))}
        {mod && (<>
          <div style={{ ...S.h, marginTop: 12 }}>Screens / actions</div>
          {mod.scopes.map((s) => {
            const k = `${s.screenId}/${s.actionId}`;
            return (
              <div key={k} style={{ ...S.item, ...(k === scopeKeySel ? S.sel : {}) }} onClick={() => { setScopeKeySel(k); setClassification(''); }}>
                {s.label}
              </div>
            );
          })}
        </>)}
      </div>

      {scope && (
        <div style={{ ...S.col, flex: 1 }}>
          <div style={S.row}>
            <div style={S.h}>{scope.label}</div>
            <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={enabled} onChange={toggleEnabled} /> Enabled for this tenant
            </label>
          </div>
          <div style={S.row}>
            <span>Mode:</span>
            <button style={{ ...S.btn, ...(mode === 'simple' ? S.primary : {}) }} onClick={() => setMode('simple')}>simple</button>
            <button style={{ ...S.btn, ...S.disabled }} disabled title="coming soon">advanced (coming soon)</button>
          </div>
          <div style={S.row}>
            <span>Classification:</span>
            {scope.classifications.map((c) => (
              <button key={c.id} style={{ ...S.btn, ...(classification === c.id ? S.primary : {}) }} onClick={() => setClassification(c.id)}>{c.label}</button>
            ))}
          </div>

          {classification && (<>
            <div style={S.h}>Steps (top to bottom)</div>
            {rows.map((r, i) => (
              <div key={i} style={S.row}>
                <span>Step {i + 1}:</span>
                <select value="" onChange={(e) => setRowRole(i, e.target.value)}>
                  <option value="" disabled>Select Approver…</option>
                  {roles.map((x) => <option key={x.roleId} value={x.roleId}>{x.roleLabel}</option>)}
                </select>
                {r.roles.map((x) => (
                  <span key={x.roleId} style={S.chip}>{x.roleLabel} <a onClick={() => removeRole(i, x.roleId)} style={{ cursor: 'pointer' }}>✕</a></span>
                ))}
                {r.roles.length > 1 && (<>
                  <button style={{ ...S.btn, ...(r.rule === 'all' ? S.primary : {}) }} onClick={() => setRule(i, 'all')}>AND</button>
                  <button style={{ ...S.btn, ...(r.rule === 'any' ? S.primary : {}) }} onClick={() => setRule(i, 'any')}>OR</button>
                </>)}
              </div>
            ))}
            <div style={S.row}>
              <button style={S.btn} onClick={addRow}>+ Add step</button>
              <button
                style={{ ...S.btn, ...S.primary, ...(rows.some((r) => r.roles.length > 0) ? {} : S.disabled) }}
                disabled={!rows.some((r) => r.roles.length > 0)}
                onClick={save}
                title="Save as a new active version"
              >✓ Save workflow</button>
            </div>
            {msg.err && <div style={S.err}>{msg.err}</div>}
            {msg.ok && <div style={S.ok}>{msg.ok}</div>}

            <div style={{ ...S.h, marginTop: 16 }}>Versions</div>
            {versions.filter((v) => v.classification === classification).map((v) => (
              <div key={v.wfuuid} style={S.row}>
                <span style={S.chip}>v{v.version}</span>
                <span>{v.status}</span>
                <span style={{ color: '#667085', fontSize: 12 }}>{new Date(v.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </>)}
        </div>
      )}
    </div>
  );
}
