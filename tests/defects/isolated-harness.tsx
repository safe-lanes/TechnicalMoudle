// Only bundled by verify-defect-forms.mjs, never registered in application routes.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UIRoleProvider } from '@/contexts/UIRoleContext';
import { queryClient } from '@/lib/queryClient';
import { zodResolver } from '@hookform/resolvers/zod';
import Before, { paritySchema as beforeSchema, parityDefaults as beforeDefaults } from 'before-exact';
import After, { paritySchema as afterSchema, parityDefaults as afterDefaults } from 'after-exact';
import DefectsLogWithTabs from '@/pages/defects/DefectsLogWithTabs';
import DefectModal from '@/pages/defects/DefectModal';

window.events = { toasts: [], invalidations: [], closed: 0 };
const invalidate = queryClient.invalidateQueries.bind(queryClient);
queryClient.invalidateQueries = (options, ...rest) => {
  const keys = [
    ['/technical/api/defects'], ['/technical/api/defects?vesselId=FIXTURE-VESSEL'],
    ['defects', 'FIXTURE-ORIGINAL-ID'], ['/technical/api/components'],
  ];
  window.events.invalidations.push(keys.map(queryKey =>
    options?.predicate?.({ queryKey }) ?? false));
  return invalidate(options, ...rest);
};

window.parity = async (defect, patch) => {
  const run = async (schema, defaults) => {
    const input = { ...defaults(defect, 'FIXTURE-PREVIEW'), ...patch };
    const parsed = schema.safeParse(input);
    const resolved = await zodResolver(schema)(input, {}, { fields: {}, shouldUseNativeValidation: false });
    return {
      parsed: parsed.success ? { success: true, data: parsed.data } : { success: false, issues: parsed.error.issues },
      resolved,
    };
  };
  return [await run(beforeSchema, beforeDefaults), await run(afterSchema, afterDefaults)];
};
window.parsedDefaults = (defect, patch) => afterSchema.parse({
  ...afterDefaults(defect, 'FIXTURE-PREVIEW'), ...patch,
});

const params = new URLSearchParams(location.search);
const screen = params.get('screen') || 'exact';
const version = params.get('version') || 'after';
const mode = params.get('mode') || 'new';
const fixture = {
  id: 'FIXTURE-ORIGINAL-ID', duuid: '00000000-0000-4000-8000-000000000001',
  vesselId: 'FIXTURE-VESSEL', vesselName: 'Fixture Vessel', category: 'Defect',
  issueDate: '2026-10-15', description: 'Fixture description',
  descriptionHtml: '<p>Fixture <strong>description</strong></p>',
  descriptionText: 'Fixture description', componentId: 'FIXTURE-COMPONENT',
  critical: false, is_coc: false, deferApprovalRequired: false, severity: 0,
};
window.fixture = fixture;
const close = () => { window.events.closed++; };
const Component = version === 'before' ? Before : After;
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <UIRoleProvider>
      <TooltipProvider>
        {screen === 'log' ? <DefectsLogWithTabs /> :
          screen === 'modal' ? <DefectModal open onClose={close} mode={mode}
            defectId={mode === 'new' ? undefined : fixture.id} /> :
            <Component mode={mode} defect={mode === 'new' ? undefined : fixture} onClose={close} />}
      </TooltipProvider>
    </UIRoleProvider>
  </QueryClientProvider>,
);
