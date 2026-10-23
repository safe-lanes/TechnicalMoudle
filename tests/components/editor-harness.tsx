// Isolated full-page editor; bundled only by verify-component-editor.mjs.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import Editor from '@/components/ComponentRegisterAddEdit';
import Components from '@/pages/pms/Components';
import { queryClient } from '@/lib/queryClient';
import { VesselContext } from '@/contexts/VesselContext';
import { TooltipProvider } from '@/components/ui/tooltip';

window.events = { toasts: [], backs: 0 };
window.cache = (url: string, value: unknown) => queryClient.setQueryData([url], value);
window.refresh = (url: string) => queryClient.invalidateQueries({ queryKey: [url] });

function Harness() {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState<string | null>('a');
  const [vesselId, setVesselId] = useState('v1');
  window.selectProp = setId;
  window.changeVessel = setVesselId;
  const fullPage = new URLSearchParams(location.search).has('full-page');
  return <QueryClientProvider client={queryClient}>
    <VesselContext.Provider value={{ vesselId, setVesselId, vessels: [], pickerVessels: [] } as any}>
      <TooltipProvider>
        {fullPage ? <Components /> : <>
        <button onClick={() => setOpen(true)}>Edit Component</button>
        <button onClick={() => { setId(null); setOpen(true); }}>Initial Add</button>
        {open && <Editor componentId={id} componentCode={id === 'b' ? '602' : id ? '601' : null}
          parentComponent={!id ? { code: '6', id: '6', name: 'Machinery' } : null}
          onBack={() => { window.events.backs++; setOpen(false); }} />}
        </>}
      </TooltipProvider>
    </VesselContext.Provider>
  </QueryClientProvider>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
