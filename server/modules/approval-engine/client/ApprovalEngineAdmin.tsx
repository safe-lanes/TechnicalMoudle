/**
 * Approval Engine — generic admin screen v1 (design v3 §B6). Lives in the engine folder's
 * client area; imports ONLY react (import boundary). A host app routes it wherever it wants
 * and may pass a basePath; all data comes from the engine HTTP API. No product strings here.
 *
 * v1 = Sahil's step-by-step builder: pick a scope from the registry tree → per classification
 * add step rows (Select Approver → AND/OR → next row) → tick to save (a new active version).
 * Mode selector shows 'advanced' disabled ("coming soon"). Per-scope enable/disable toggle.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfiguredApproverRole, type ConfiguredApproverLookup } from './ConfiguredApproverRole';

interface Props {
  basePath?: string;
  /** Host-controlled scope: when given, the builder edits exactly this scope and hides its own
   *  Modules / Screens picker (the host renders its own tree). */
  scope?: { moduleId: string; screenId: string; actionId?: string } | null;
  /** View only: no add/save, and the enable switch is disabled (host permission = view). */
  readOnly?: boolean;
}
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

export default function ApprovalEngineAdmin({ basePath = '/approval-engine', scope: hostScope = null, readOnly = false }: Props) {
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Each selection owns its requests, draft and save lock. A new identity also handles
  // switching away and back before an earlier request completes.
  const request = useRef({ key: '', revision: 0, saving: false });
  const [versions, setVersions] = useState<WorkflowSummary[]>([]);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  // F7 — read-only "View configured approvers/tiers" for the active version of the selected
  // classification: steps, roles, quorum, resolved approver names, and a ⚠ marker where a role
  // resolves to nobody (the same silent-stall risk F3 addresses at runtime).
  const [viewSteps, setViewSteps] = useState<Array<{ label: string; rule: string; slots: Array<{ roleId: string; roleLabel: string }> }> | null>(null);
  const [approverNames, setApproverNames] = useState<Record<string, ConfiguredApproverLookup>>({});
  // Jeevan #1: only the active version is listed; older versions behind "Show history".
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useEffect(() => { api('GET', '/registry').then(setTree).catch((e) => setMsg({ err: String(e.message) })); }, [api]);
  const hostKey = hostScope ? `${hostScope.moduleId}|${hostScope.screenId}/${hostScope.actionId ?? ''}` : '';
  useEffect(() => {
    if (!hostScope) return;
    setModuleId(hostScope.moduleId);
    setScopeKeySel(`${hostScope.screenId}/${hostScope.actionId ?? ''}`);
    setClassification('');
  }, [hostKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const mod = useMemo(() => tree?.modules.find((m) => m.moduleId === moduleId), [tree, moduleId]);
  const scope = useMemo(() => mod?.scopes.find((s) => `${s.screenId}/${s.actionId}` === scopeKeySel), [mod, scopeKeySel]);
  const scopeQuery = scope ? `moduleId=${encodeURIComponent(moduleId)}&screenId=${encodeURIComponent(scope.screenId)}&actionId=${encodeURIComponent(scope.actionId)}` : '';
  const scopeDto = scope ? { moduleId, screenId: scope.screenId, actionId: scope.actionId } : null;
  const selectionKey = `${basePath}|${hostKey}|${scopeQuery}|${classification}`;
  const [selection, setSelection] = useState(selectionKey);
  // Reset during selection, before rendering any controls for the new chain.
  // An effect-only reset would briefly expose the previous selection's draft.
  if (selection !== selectionKey) {
    request.current = { key: selectionKey, revision: 0, saving: false };
    setSelection(selectionKey);
    setRows([]); setEditing(false); setSaving(false);
    setVersions([]); setViewSteps(null); setApproverNames({});
    setLoading(true); setLoadError(''); setMsg({}); setShowVersionHistory(false);
  }
  useEffect(() => () => {
    request.current = { key: '', revision: 0, saving: false };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const owner = request.current;
    const current = () => !cancelled && request.current === owner;
    if (!scope) return;
    setRoles([]);
    api('GET', `/roles?${scopeQuery}`).then((r) => { if (current()) setRoles(r); }).catch((e) => { if (current()) setMsg({ err: String(e.message) }); });
    api('GET', `/scopes/enabled?${scopeQuery}`).then((r) => { if (current()) setEnabled(!!r.enabled); }).catch(() => { if (current()) setEnabled(true); });
    api('GET', `/workflows?${scopeQuery}`).then((r) => {
      if (!current()) return;
      setVersions(r); setLoading(false);
    }).catch((e) => {
      if (current()) { setLoadError(`Could not load workflow versions: ${e.message}`); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [api, scopeQuery, scope, selectionKey]);

  useEffect(() => {
    if (readOnly) { setEditing(false); setRows([]); }
  }, [readOnly]);

  // F7 — load the active version's steps + resolved approver names for the read-only view.
  useEffect(() => {
    let cancelled = false;
    const owner = request.current;
    const revision = owner.revision;
    const current = () => !cancelled && request.current === owner && owner.revision === revision;
    if (!classification) return;
    const active = versions
      .filter((v) => v.classification === classification && v.status === 'active')
      .sort((a, b) => b.version - a.version)[0]
      ?? versions.filter((v) => v.classification === classification).sort((a, b) => b.version - a.version)[0];
    if (!active) return;
    setLoading(viewSteps === null);
    api('GET', `/workflows/${active.wfuuid}`).then(async (wf: any) => {
      if (!current()) return;
      const steps = (wf?.nodes ?? [])
        .filter((n: any) => n.type === 'approval-step')
        .sort((a: any, b: any) => a.ordinal - b.ordinal)
        .map((n: any) => ({ label: n.label || n.key, rule: n.quorum?.rule ?? 'all', slots: (n.slots ?? []).map((s: any) => ({ roleId: s.roleId, roleLabel: s.roleLabel })) }));
      setViewSteps(steps);
      setLoading(false); setLoadError('');
      const uniqueRoleIds = Array.from(new Set(steps.flatMap((s: any) => s.slots.map((x: any) => x.roleId))));
      const entries = await Promise.all(uniqueRoleIds.map(async (rid) => {
        try {
          const res = await fetch(`/technical/api/approvals/role-approvers?roleId=${encodeURIComponent(rid as string)}`);
          // Jeevan #13: a refused/failed lookup is NOT "no approver" — say it could not be loaded.
          if (!res.ok) return [rid, { names: [], vesselScoped: false, error: `could not load the approvers (HTTP ${res.status})` }] as const;
          const j = await res.json();
          return [rid, { names: j.names ?? [], vesselScoped: !!j.vesselScoped, users: Array.isArray(j.users) ? j.users : undefined }] as const;
        } catch { return [rid, { names: [], vesselScoped: false, error: 'could not load the approvers' }] as const; }
      }));
      if (current()) setApproverNames(Object.fromEntries(entries));
    }).catch((e) => {
      if (current()) { setLoadError(`Could not load saved workflow: ${e.message}`); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [api, classification, versions, selectionKey]);

  const canMutate = editing && !readOnly && !saving;
  const addRow = () => {
    if (readOnly || saving || loading || loadError) return;
    setRows((r) => [...(editing ? r : (viewSteps ?? []).map((s) => ({
      roles: s.slots.map((role) => ({ ...role })), rule: s.rule === 'any' ? 'any' as const : 'all' as const,
    }))), { roles: [], rule: 'all' }]);
    setEditing(true); setMsg({});
  };
  const setRowRole = (i: number, roleId: string) => {
    if (!canMutate) return;
    const role = roles.find((r) => r.roleId === roleId);
    if (!role) return;
    setRows((rs) => rs.map((r, idx) => idx !== i || r.roles.some((x) => x.roleId === roleId) ? r : { ...r, roles: [...r.roles, role] }));
  };
  const removeRole = (i: number, roleId: string) => { if (canMutate) setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, roles: r.roles.filter((x) => x.roleId !== roleId) } : r)); };
  const setRule = (i: number, rule: 'all' | 'any') => { if (canMutate) setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, rule } : r))); };

  const save = async () => {
    if (!scopeDto || !classification || !canMutate || request.current.saving || !rows.some((r) => r.roles.length)) return;
    const owner = request.current;
    owner.saving = true;
    const current = () => request.current === owner;
    setSaving(true); setMsg({});
    const steps = rows.filter((r) => r.roles.length > 0);
    const nodes = steps.map((r, i) => ({
      key: `step-${i + 1}`, type: 'approval-step', label: `Step ${i + 1}`, ordinal: i,
      quorum: { rule: r.rule }, slots: r.roles.map((x) => ({ roleId: x.roleId, roleLabel: x.roleLabel })),
    }));
    const all = [...nodes, { key: 'end', type: 'end', label: 'End', ordinal: nodes.length }];
    const edges = all.slice(0, -1).map((n, i) => ({ from: n.key, to: all[i + 1].key }));
    try {
      const saved = await api('POST', '/workflows', { scope: scopeDto, classification, mode, label: `v-next`, nodes: all, edges });
      if (!current()) return;
      owner.revision += 1; // Ignore details requested before this confirmed save.
      const revision = owner.revision;
      setViewSteps(nodes.map((n) => ({ label: n.label, rule: n.quorum.rule, slots: n.slots })));
      setVersions((vs) => [
        ...vs.filter((v) => v.wfuuid !== saved.wfuuid).map((v) =>
          v.classification === classification && v.status === 'active' ? { ...v, status: 'superseded' } : v),
        saved,
      ]);
      setEditing(false); setRows([]);
      setMsg({ ok: `Saved as version ${saved.version} (active).` });
      api('GET', `/workflows?${scopeQuery}`).then((r) => { if (current() && owner.revision === revision) setVersions(r); }).catch((e) => {
        if (current() && owner.revision === revision) setMsg({ ok: `Saved as version ${saved.version} (active).`, err: `Could not refresh version details: ${e.message}` });
      });
    } catch (e: any) { if (current()) setMsg({ err: String(e.message) }); }
    finally { owner.saving = false; if (current()) setSaving(false); }
  };
  const toggleEnabled = async () => {
    if (!scopeDto) return;
    const owner = request.current;
    try { const r = await api('PUT', '/scopes/enabled', { scope: scopeDto, enabled: !enabled }); if (request.current === owner) setEnabled(!!r.enabled); }
    catch (e: any) { if (request.current === owner) setMsg({ err: String(e.message) }); }
  };

  return (
    <div style={hostScope ? { ...S.page, padding: 0 } : S.page}>
      {hostScope && !scope && tree && <div style={S.err}>This approval action is not registered with the approval engine.</div>}
      {!hostScope && <div style={S.col}>
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
      </div>}

      {scope && (
        <div style={{ ...S.col, flex: 1 }}>
          <div style={S.row}>
            <div style={S.h}>{scope.label}</div>
            <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={enabled} onChange={toggleEnabled} disabled={readOnly} /> Enabled for this tenant
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
            {loading && <div role="status">Loading saved workflow…</div>}
            {loadError && <div role="alert" style={S.err}>{loadError}</div>}
            {!editing && !loading && !loadError && !(viewSteps?.length) && <div style={{ color: '#667085', marginBottom: 8 }}>No workflow saved for this classification.</div>}
            {!editing && viewSteps?.map((st, i) => (
              <div key={i} style={S.row} data-testid={`saved-workflow-step-${i + 1}`}>
                <span>Step {i + 1}:</span>
                {st.slots.map((role) => <span key={role.roleId} style={S.chip}>{role.roleLabel}</span>)}
                {st.slots.length > 1 && <span>{st.rule === 'any' ? 'OR — any one approves' : 'AND — all must approve'}</span>}
              </div>
            ))}
            {editing && !readOnly && rows.map((r, i) => (
              <div key={i} style={S.row}>
                <span>Step {i + 1}:</span>
                <select aria-label={`Step ${i + 1} approver`} disabled={saving} value="" onChange={(e) => setRowRole(i, e.target.value)}>
                  <option value="" disabled>Select Approver…</option>
                  {roles.map((x) => <option key={x.roleId} value={x.roleId}>{x.roleLabel}</option>)}
                </select>
                {r.roles.map((x) => (
                  <span key={x.roleId} style={S.chip}>{x.roleLabel} <button disabled={saving} aria-label={`Remove ${x.roleLabel} from step ${i + 1}`} onClick={() => removeRole(i, x.roleId)} style={{ cursor: 'pointer' }}>✕</button></span>
                ))}
                {r.roles.length > 1 && (<>
                  <button disabled={saving} style={{ ...S.btn, ...(r.rule === 'all' ? S.primary : {}) }} onClick={() => setRule(i, 'all')}>AND</button>
                  <button disabled={saving} style={{ ...S.btn, ...(r.rule === 'any' ? S.primary : {}) }} onClick={() => setRule(i, 'any')}>OR</button>
                </>)}
              </div>
            ))}
            {!readOnly && <div style={S.row}>
              <button style={{ ...S.btn, ...(saving || loading || loadError ? S.disabled : {}) }} disabled={saving || loading || !!loadError} onClick={addRow}>+ Add step</button>
              {editing && <button
                style={{ ...S.btn, ...S.primary, ...(rows.some((r) => r.roles.length > 0) ? {} : S.disabled) }}
                disabled={saving || !rows.some((r) => r.roles.length > 0)}
                onClick={save}
                title="Save as a new active version"
              >{saving ? 'Saving…' : '✓ Save workflow'}</button>}
            </div>}
            {readOnly && <div style={{ color: '#667085', fontSize: 13, marginBottom: 8 }}>View only — you do not have permission to change this approval workflow.</div>}
            {msg.err && <div role="alert" style={S.err}>{msg.err}</div>}
            {msg.ok && <div style={S.ok}>{msg.ok}</div>}

            <div style={{ ...S.h, marginTop: 16 }}>Versions</div>
            {(() => {
              const mine = versions.filter((v) => v.classification === classification).sort((a, b) => b.version - a.version);
              const current = mine.find((v) => v.status === 'active') ?? mine[0];
              const older = mine.filter((v) => v !== current);
              const row = (v: WorkflowSummary) => (
                <div key={v.wfuuid} style={S.row} data-testid={`workflow-version-${v.version}`}>
                  <span style={S.chip}>v{v.version}</span>
                  <span>{v.status}</span>
                  <span style={{ color: '#667085', fontSize: 12 }}>{new Date(v.createdAt).toLocaleString()}</span>
                </div>
              );
              return (<>
                {current ? row(current) : <div style={{ color: '#667085', fontSize: 13 }}>No version saved yet.</div>}
                {older.length > 0 && (
                  <button type="button" onClick={() => setShowVersionHistory((x) => !x)} data-testid="toggle-version-history"
                    style={{ background: 'none', border: 'none', color: '#1570ef', cursor: 'pointer', padding: '4px 0', fontSize: 13 }}>
                    {showVersionHistory ? 'Hide history' : `Show history (${older.length})`}
                  </button>
                )}
                {showVersionHistory && older.map(row)}
              </>);
            })()}

            {/* F7 — read-only view of the configured approvers/tiers for the active version */}
            {viewSteps && viewSteps.length > 0 && (
              <div data-testid="configured-approvers-view" style={{ marginTop: 16, border: '1px solid #e4e7ec', borderRadius: 8, padding: 12 }}>
                <div style={{ ...S.h, marginTop: 0 }}>Configured approvers (active version — read-only)</div>
                {viewSteps.map((st, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      Step {i + 1}: {st.label}{st.slots.length > 1 ? ` — ${st.rule === 'any' ? 'any one approves' : 'all must approve'}` : ''}
                    </div>
                    {st.slots.map((sl) => (
                      <ConfiguredApproverRole key={sl.roleId} roleLabel={sl.roleLabel} result={approverNames[sl.roleId]} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>)}
        </div>
      )}
    </div>
  );
}
