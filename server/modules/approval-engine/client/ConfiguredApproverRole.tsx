import React from 'react';

export type ConfiguredApproverLookup = {
  names: string[];
  vesselScoped: boolean;
  error?: string;
  /** The read-only API populates vessels from active assignments only. */
  users?: Array<{ id: string; name: string; vessels: string[] }>;
};

/** Display-only: no request-vessel matching or runtime approval eligibility changes. */
export function ConfiguredApproverRole({ roleLabel, result }: {
  roleLabel: string;
  result?: ConfiguredApproverLookup;
}) {
  const cell: React.CSSProperties = { padding: '4px 8px', border: '1px solid #e4e7ec' };
  let message: string | undefined;
  let testId: string | undefined;
  if (!result) {
    message = 'resolving…';
  } else if (result.error) {
    message = result.error;
    testId = 'configured-approver-load-error';
  } else if (!Array.isArray(result.users)) {
    // A legacy names-only response cannot establish whether a user has an active assignment.
    message = 'could not load the approvers’ active vessel assignments';
    testId = 'configured-approver-load-error';
  }

  const users = new Map<string, { id: string; name: string; vessels: Set<string> }>();
  if (!message) {
    for (const user of result!.users!) {
      const vessels = user.vessels.filter((vessel) => vessel.trim().length > 0);
      if (vessels.length === 0) continue;
      const existing = users.get(user.id);
      if (existing) {
        vessels.forEach((vessel) => existing.vessels.add(vessel));
      } else {
        users.set(user.id, { id: user.id, name: user.name, vessels: new Set(vessels) });
      }
    }
    if (users.size === 0) {
      message = 'No configured approvers have an active vessel assignment.';
      testId = 'configured-approver-unresolved';
    }
  }

  return (
    <div style={{ marginLeft: 12, marginTop: 4 }}>
      <div style={{ fontWeight: 500, fontSize: 13 }}>{roleLabel}</div>
      {message ? (
        <div data-testid={testId} style={{ color: '#667085', fontSize: 13, marginTop: 2 }}>{message}</div>
      ) : (
        <>
          <table data-testid="configured-approver-table" style={{ borderCollapse: 'collapse', fontSize: 12, marginTop: 4, width: '100%' }}>
            <thead><tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={cell}>User</th>
              <th style={cell}>Role</th>
              <th style={cell}>Assigned vessels</th>
            </tr></thead>
            <tbody>{Array.from(users.values()).map((user) => (
              <tr key={user.id}>
                <td style={cell}>{user.name}</td>
                <td style={cell}>{roleLabel}</td>
                <td style={cell}>{Array.from(user.vessels).sort().join(', ')}</td>
              </tr>
            ))}</tbody>
          </table>
          {result?.vesselScoped && (
            <div style={{ color: '#667085', fontSize: 12, marginTop: 2 }}>
              Approvers for a request are those assigned that request's vessel in SAILERP.
            </div>
          )}
        </>
      )}
    </div>
  );
}
