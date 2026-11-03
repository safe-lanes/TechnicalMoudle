import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';
import * as presentation from '../../../../client/src/pages/defects/defectApprovalPresentation';
import * as approvalGate from '../../../../client/src/components/approvals/approvalGate';

// Local JSX transform: the server test configuration intentionally does not
// transform frontend JSX. Render production components without browser portals.
const nativeRequire = createRequire(import.meta.url);
function compile(source: string, dependencies: Record<string, any> = {}, bindings: Record<string, any> = {}) {
  const module = { exports: {} as any };
  const code = transformSync(source, { loader: 'tsx', jsx: 'automatic', format: 'cjs' }).code;
  const require = (name: string) => dependencies[name] ?? nativeRequire(name);
  new Function('require', 'module', 'exports', ...Object.keys(bindings), code)(
    require, module, module.exports, ...Object.values(bindings),
  );
  return module.exports;
}
const processModule = compile(readFileSync('client/src/components/approvals/ApprovalProcessSection.tsx', 'utf8'), {
  '@/pages/defects/defectApprovalPresentation': presentation,
});
const chainModule = compile(readFileSync('client/src/components/approvals/ApprovalChainProgress.tsx', 'utf8'), {
  './approvalGate': approvalGate,
  '@/pages/defects/defectApprovalPresentation': presentation,
  '@/contexts/AuthContext': { useAuth: () => ({ currentUser: null }) },
  '@tanstack/react-query': { useQuery: () => ({ data: [] }) },
});
const extensionModule = compile(readFileSync('client/src/pages/defects/DefectExtensionApprovalProcess.tsx', 'utf8'), {
  '@/components/approvals/ApprovalProcessSection': processModule,
  '@/components/approvals/ApprovalChainProgress': chainModule,
});
const wizardSource = readFileSync('client/src/pages/defects/DefectFormWizard.tsx', 'utf8');
const wizardAst = ts.createSourceFile('wizard.tsx', wizardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functionNames = ['ExtensionCard', 'DefectApprovalStatus'];
const functions = wizardAst.statements.filter((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && functionNames.includes(node.name?.text ?? ''),
).map(node => node.getText(wizardAst).replace(/^export\s+/, '')).join('\n');
const controls = ({ canEdit }: any) => canEdit ? React.createElement('button', { 'data-decision': true }, 'Approve / Reject') : null;
const wizardBindings = {
  ...presentation, ...chainModule, ...extensionModule,
  ApprovalDecisionPanel: controls, ApprovalWorkflowPreview: () => React.createElement('div', null, 'Workflow preview'),
  Button: ({ children, ...props }: any) => React.createElement('button', props, children),
};
const cardModule = compile(`${functions}\nexport { ExtensionCard, DefectApprovalStatus };`, {}, wizardBindings);
const expressions: string[] = [];
function visit(node: ts.Node) {
  if (ts.isJsxExpression(node) && node.expression) {
    const text = node.expression.getText(wizardAst);
    if (text.startsWith('extensionHistory.slice(') ||
        (text.startsWith('displayedExtension && (') && text.includes('<ExtensionCard'))) expressions.push(text);
  }
  ts.forEachChild(node, visit);
}
visit(wizardAst);
const html = (Component: any, props: any) => renderToStaticMarkup(React.createElement(Component, props));
const event = (type = 'submitted', label = 'Requested', extras = {}) => ({
  type, label, byName: 'Example Master', byPosition: 'Master',
  at: '2026-11-03T08:36:00Z', remarks: null, ...extras,
});
const process = { subjectType: 'defect-extension', attempts: [
  { number: 1, events: [event(), event('approved', 'Approved — Step 1', { remarks: 'ADMIN OVERRIDE\nOriginal reason' })] },
  { number: 2, events: [event('submitted', 'Requested again'), event('rejected', 'Rejected — Step 2', { remarks: 'Please revise the date' })] },
] };
const chain = {
  hasActiveWorkflow: true, requestUuid: 'request-current', requestStatus: 'pending', currentStepKey: 'second',
  currentUserCanDecide: true, currentUserSlotId: 'slot-b', steps: [
    { key: 'first', label: 'Step 1', status: 'approved', slots: [{ status: 'pending', roleLabel: 'Old unused role' }] },
    { key: 'second', label: 'Step 2', status: 'active', slots: [
      { status: 'approved', roleLabel: 'Superintendent', decidedByName: 'Earlier Approver', decidedAt: '2026-11-03T08:35:00Z' },
      { status: 'active', roleLabel: 'Marine Manager', remarks: 'Waiting for review' },
    ] },
  ],
};
const entry = (id: string) => ({
  id, status: 'Requested', existingTargetDate: '2026-11-10', newTargetDate: '2026-11-12',
  reasonForExtension: 'Repair scheduling', requestedByName: 'Example Master', requestedByPosition: 'Master', requestedAt: '2026-11-03',
});
function renderCards({ draft = false, saved = true, readOnly = false } = {}) {
  expect(expressions).toHaveLength(2);
  const latest = saved ? entry('latest') : null;
  const bindings = {
    ...wizardBindings, ...cardModule,
    WithdrawRequestPanel: () => React.createElement('button', { 'data-withdraw': true }, 'Withdrawal'),
    extensionHistory: saved ? [{ entry: entry('older'), chain }, { entry: latest, chain }] : [],
    isDraftingExtension: draft, latestExtension: latest, displayedExtension: draft ? null : latest,
    visibleExtensionTotal: (saved ? 2 : 0) + Number(draft), orderedExtensions: saved ? [entry('older'), latest] : [],
    defectApprovalProcess: { data: { extension: process }, isLoading: false },
    currentExtensionChain: chain, hasExtensionChainsProjection: true,
    currentExtensionApproval: { data: chain, error: null, isLoading: false, refetch: vi.fn() },
    extensionApproval: { data: chain, error: null, isLoading: false },
    approvalDefectId: 'defect-fixture', canEditDefect: true, isViewMode: readOnly, displayedExtensionStatus: 'Requested',
  };
  const Cards = compile(`export default function Cards() { return <>${expressions.map(e => `{${e}}`).join('')}</>; }`, {}, bindings).default;
  return html(Cards, {});
}

describe('Consolidated B5 approval display', () => {
  it('preserves every event, attempt, actor, UTC time and multiline override remark in compact rows', () => {
    const rendered = html(extensionModule.DefectExtensionApprovalProcess, { process });
    for (const text of ['Attempt 1', 'Attempt 2', 'Requested again', 'Approved — Step 1', 'Rejected — Step 2',
      'Example Master (Master)', '03 Nov 2026, 0836 Z', 'ADMIN OVERRIDE\nOriginal reason', 'Please revise the date']) {
      expect(rendered).toContain(text);
    }
    expect(rendered.indexOf('Requested again')).toBeGreaterThan(rendered.indexOf('Approved — Step 1'));
    expect(rendered).toContain('sm:grid-cols-');
    expect(rendered).toContain('[overflow-wrap:anywhere]');
    expect(rendered).not.toContain('Approval progress');
  });
  it('uses the actual current step, including partial approvals, rather than an old unused pending slot', () => {
    const rendered = html(extensionModule.DefectExtensionApprovalProcess, { process, chain });
    expect(rendered).toContain('Current pending step: Step 2');
    expect(rendered).toContain('Earlier Approver');
    expect(rendered).toContain('0835 Z');
    expect(rendered).toContain('Marine Manager: active');
    expect(rendered).not.toContain('Old unused role');
  });
  it('does not invent identity or time for legacy events', () => {
    const rendered = html(extensionModule.DefectExtensionApprovalProcess, {
      process: { ...process, attempts: [{ number: 1, events: [event('approved', 'Approved', { byName: null, byPosition: null, at: null })] }] },
    });
    expect(rendered).toContain('Not Recorded on Not Recorded');
    expect(rendered).not.toContain('Example Master');
  });
  it('uses active slot context when older chain data omits the step status and current key', () => {
    const rendered = html(extensionModule.DefectExtensionApprovalProcess, {
      process, chain: { ...chain, currentStepKey: null, steps: chain.steps.map(step => ({ ...step, status: undefined })) },
    });
    expect(rendered).toContain('Current pending step: Step 2');
    expect(rendered).toContain('Marine Manager: active');
    expect(rendered).not.toContain('Old unused role');
  });
  it.each(['approved', 'rejected', 'withdrawn'])('retains %s terminal history without pending context', status => {
    const rendered = html(extensionModule.DefectExtensionApprovalProcess, { process, chain: { ...chain, requestStatus: status } });
    expect(rendered).toContain('Requested again');
    expect(rendered).not.toContain('extension-current-pending-step');
  });
  it('keeps loading and honest chain fallback under a single process heading', () => {
    const rendered = html(extensionModule.DefectExtensionApprovalProcess, { isLoading: true, chain });
    expect(rendered).toContain('Loading approval process');
    expect(rendered).toContain('Marine Manager');
    expect(rendered.match(/Approval process/g)).toHaveLength(1);
    expect(rendered).not.toContain('Approval progress');
  });
  it.each(['loading', 'error'])('does not claim a chain is absent when its status is %s', chainStatus => {
    const rendered = html(extensionModule.DefectExtensionApprovalProcess, { chainStatus });
    expect(rendered).not.toContain('No current approval chain was returned');
    expect(rendered).not.toContain('No approval chain is associated');
  });
  it.each([false, true])('places history once below submitted-by, including repeat draft=%s', draft => {
    const rendered = renderCards({ draft });
    expect(rendered.match(/data-testid="defect-extension-approval-process"/g)).toHaveLength(1);
    expect(rendered.indexOf('data-testid="extension-submitted-by-latest"')).toBeLessThan(rendered.indexOf('data-testid="defect-extension-approval-process"'));
    expect(rendered).toContain('extension-history-older');
    expect(rendered).not.toContain('Approval progress');
    expect(rendered).not.toContain('approval-process-section');
    if (!draft) {
      expect(rendered).toContain('data-decision="true"');
      expect(rendered).toContain('data-withdraw="true"');
    }
  });
  it('does not add recorded process history to a new unsaved extension', () => {
    expect(renderCards({ saved: false, draft: true })).not.toContain('defect-extension-approval-process');
  });
  it('preserves the history but does not expose decision controls in read-only mode', () => {
    const rendered = renderCards({ readOnly: true });
    expect(rendered).toContain('Requested again');
    expect(rendered).not.toContain('data-decision="true"');
  });
  it('keeps historical legacy outcomes, extension details and approver comments', () => {
    const rendered = html(cardModule.ExtensionCard, {
      entry: { ...entry('legacy'), status: 'Approved', approvalDate: '2026-11-03', approverComments: 'Legacy approval reason' },
      index: 0, total: 2, current: false, chain: null,
    });
    for (const text of ['extension-history-legacy', '2026-11-10', '2026-11-12',
      'Repair scheduling', 'Approved', 'Legacy approval reason']) expect(rendered).toContain(text);
    expect(rendered).not.toContain('Approval progress');
  });
  it.each(['loading', 'error', 'ship-unavailable', 'no-workflow'])('preserves %s status guidance with the old progress suppressed', state => {
    const approval = { data: state === 'no-workflow' ? { ...chain, hasActiveWorkflow: false, requestUuid: null, requestStatus: null, steps: [] } : undefined,
      isLoading: state === 'loading', error: state === 'error' ? new Error('offline') :
        state === 'ship-unavailable' ? { code: 'APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE', status: 503 } : null, refetch: vi.fn() };
    const rendered = html(cardModule.DefectApprovalStatus, { action: 'extension', defectId: 'fixture', approval, canEdit: true, showProgress: false });
    expect(rendered).toContain(`approval-status-${state}-extension`);
    expect(rendered).not.toContain('data-decision="true"');
  });
  it('keeps Verification and shared default progress headings unchanged', () => {
    const rendered = html(cardModule.DefectApprovalStatus, { action: 'verification', defectId: 'fixture',
      approval: { data: chain, isLoading: false, error: null }, canEdit: true });
    expect(rendered).toContain('Approval progress');
    expect(rendered).toContain('data-decision="true"');
    const shared = html(processModule.ApprovalProcessSection, { blocks: [{ title: 'Verification', process }] });
    expect(shared).toContain('approval-process-section');
    expect(shared).toContain('Verification');
    expect(wizardSource).toContain('title: "Verification", process: defectApprovalProcess.data?.verification');
  });
});
